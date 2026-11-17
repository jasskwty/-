import "server-only";
import { matchesSubject, normalizeAr } from "@/lib/subjectMatch";
import { UserFacingError } from "../claude";
import { cached, fetchExternal } from "./http";

// موقع «مدرستي» school-kw.com: نسوي فهرس للعناوين والروابط فقط.
// الملفات نفسها ما ننزلها: الطالب أو المعلم يفتحها في موقعهم.
export const SKW_BASE = "https://school-kw.com";
const ROOT_SECTION = 105; // الملفات التعليمية
const HOUR = 3600 * 1000;

const GRADE_NAMES: Record<string, string> = {
  "6": "الصف السادس",
  "7": "الصف السابع",
  "8": "الصف الثامن",
  "9": "الصف التاسع",
  "10": "الصف العاشر",
  "11": "الصف الحادي عشر",
  "12": "الصف الثاني عشر",
};
const TERM_NAMES = { 1: "الفصل الأول", 2: "الفصل الثاني" } as const;

interface Section {
  id: number;
  title: string;
  children: { id: number; name: string }[];
  files: { id: number; title: string }[];
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&raquo;/g, "»")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** يقرأ صفحة قسم: الأقسام الفرعية والملفات (بدون أسلاف القسم وبدون «آخر الملفات المضافة») */
async function section(id: number): Promise<Section> {
  return cached(`skw:section:${id}`, 6 * HOUR, async () => {
    const html = await (await fetchExternal(`${SKW_BASE}/section/${id}/`)).text();
    const title = decode(html.match(/<title>([^<]*)/)?.[1] ?? "").replace(/\s*-\s*مدرستي\s*$/, "");
    const ancestors = new Set(
      [...html.matchAll(/"@id":\s*"https:\/\/school-kw\.com\/section\/(\d+)\/"/g)].map((m) => Number(m[1])),
    );
    const main = html.split("آخر الملفات المضافة")[0];
    const seen = new Set<number>();
    const children: Section["children"] = [];
    for (const m of main.matchAll(/<a[^>]+href="https:\/\/school-kw\.com\/section\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/g)) {
      const cid = Number(m[1]);
      const name = decode(m[2]);
      if (!name || cid === id || ancestors.has(cid) || seen.has(cid)) continue;
      seen.add(cid);
      children.push({ id: cid, name });
    }
    const fseen = new Set<number>();
    const files: Section["files"] = [];
    for (const m of main.matchAll(/<a[^>]+href="https:\/\/school-kw\.com\/file\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/g)) {
      const fid = Number(m[1]);
      const t = decode(m[2]);
      if (!t || fseen.has(fid)) continue;
      fseen.add(fid);
      files.push({ id: fid, title: t });
    }
    return { id, title, children, files };
  });
}

const findChild = (s: Section, name: string) => s.children.find((c) => normalizeAr(c.name) === normalizeAr(name));
const isTerm = (name: string) => /الفصل (الأول|الثاني)/.test(name);

export interface SkwSubject {
  id: number; // رقم قسم المادة في موقعهم
  name: string;
  match: boolean;
}

/** مواد صف معيّن (وفصل دراسي إذا الموقع يقسم الصف بالفصول أول) */
export async function skwSubjects(grade: string, term: 1 | 2, subject: string): Promise<{ subjects: SkwSubject[]; source: string }> {
  const gradeName = GRADE_NAMES[grade];
  if (!gradeName) throw new UserFacingError("الصف غير مدعوم.");
  const root = await section(ROOT_SECTION);
  const g = findChild(root, gradeName);
  if (!g) throw new UserFacingError("ما لقينا هذا الصف في موقع مدرستي.", 502);
  let level = await section(g.id);
  let sourceId = g.id;
  // الصفوف المتوسطة: الصف ← الفصل ← المادة
  if (level.children.some((c) => isTerm(c.name))) {
    const t = findChild(level, TERM_NAMES[term]);
    if (!t) throw new UserFacingError("ما لقينا هذا الفصل الدراسي في موقع مدرستي.", 502);
    level = await section(t.id);
    sourceId = t.id;
  }
  const names = level.children.map((c) => c.name);
  return {
    subjects: level.children.filter((c) => !isTerm(c.name)).map((c) => ({ ...c, match: matchesSubject(c.name, subject, names) })),
    source: `${SKW_BASE}/section/${sourceId}/`,
  };
}

const TYPES: [RegExp, string][] = [
  [/توزيع منهج|خطة/, "خطط وتوزيع المنهج"],
  [/(^|\s)(حل|حلول|اجابة|إجابة|إجابات|اجابات)(\s|$)/, "حلول وإجابات"],
  [/اختبار|امتحان|نموذج/, "اختبارات"],
  [/بنك/, "بنك أسئلة"],
  [/مراجع/, "مراجعات"],
  [/ملخص|انفوجرافيك|مذكر|مصطلحات/, "ملخصات ومذكرات"],
  [/ورق|تدريب|أوراق|تمارين/, "أوراق عمل"],
  [/تقرير|مشروع|بحث/, "تقارير ومشاريع"],
  [/شرح|كورس|عينة درس|الكتاب|درس/, "شروحات"],
];

/** ملفات مادة معيّنة (الثانوي: المادة ← الفصل) */
export async function skwFiles(sectionId: number, term: 1 | 2) {
  let s = await section(sectionId);
  if (s.children.some((c) => isTerm(c.name))) {
    const t = findChild(s, TERM_NAMES[term]);
    if (t) s = await section(t.id);
  }
  return {
    title: s.title,
    source: `${SKW_BASE}/section/${s.id}/`,
    files: s.files.map((f) => ({
      ...f,
      type: TYPES.find(([re]) => re.test(f.title))?.[1] ?? "أخرى",
      url: `${SKW_BASE}/file/${f.id}/`,
    })),
  };
}
