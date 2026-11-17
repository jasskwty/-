import "server-only";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { matchesSubject } from "@/lib/subjectMatch";
import { UserFacingError } from "../claude";
import { cached, fetchExternal } from "./http";

// مكتبة وزارة التربية الإلكترونية: نستخدم نفس الواجهة البرمجية العامة اللي تستخدمها صفحتهم
export const MOE_BASE = "https://elibrary.moe.edu.kw";
const MOE_YEAR = 2023; // القيمة الثابتة اللي تستخدمها صفحة المكتبة نفسها
const EDUCATION_TYPE = 8; // التعليم العام

// صفوف التطبيق ← (المرحلة، الصف) في مكتبة الوزارة
const GRADE_MAP: Record<string, { stage: number; grade: number }> = {
  "6": { stage: 15, grade: 20 },
  "7": { stage: 15, grade: 21 },
  "8": { stage: 15, grade: 22 },
  "9": { stage: 15, grade: 23 },
  "10": { stage: 17, grade: 27 },
  "11": { stage: 17, grade: 28 },
  "12": { stage: 17, grade: 29 },
};

export interface MoeItem {
  id: number;
  kind: "book" | "exam";
  title: string;
  subjectId: number;
  label?: string; // مثل: أوراق عمل / مراجعات / دليل المعلم
  url: string; // رابط الملف في موقع الوزارة
}
export interface MoeCatalog {
  subjects: { id: number; name: string; match: boolean }[];
  books: MoeItem[];
  exams: MoeItem[];
  videos: { id: number; title: string; subjectId: number; youtubeId: string }[];
  source: string;
}

const DAY = 24 * 3600 * 1000;

export function moeFileUrl(kind: "book" | "exam", id: number) {
  return kind === "book" ? `${MOE_BASE}/api/File/preview/book/${id}` : `${MOE_BASE}/api/File/download/examfile/${id}`;
}

export async function moeCatalog(grade: string, term: 1 | 2, forTeachers: boolean, subject: string): Promise<MoeCatalog> {
  const g = GRADE_MAP[grade];
  if (!g) throw new UserFacingError("الصف غير مدعوم.");
  const subjects = await cached(`moe:subjects:${g.grade}`, DAY, async () => {
    const r = await fetchExternal(`${MOE_BASE}/api/LibraryLookups/EducationSubjects/${g.grade}`);
    const j = (await r.json()) as { data: { value: number; text: string }[] };
    return j.data.map((s) => ({ id: s.value, name: s.text.replace(/\s+/g, " ").trim() }));
  });
  const data = await cached(`moe:search:${g.grade}:${term}:${forTeachers}`, 6 * 3600 * 1000, async () => {
    const r = await fetchExternal(`${MOE_BASE}/api/librarysearch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        BooksFor: forTeachers ? 2 : 1,
        MoeYear: MOE_YEAR,
        EducationTypeID: EDUCATION_TYPE,
        EducationStageID: g.stage,
        EducationGradeID: g.grade,
        EducationSubjectID: 0, // كل المواد
        Term: term,
      }),
    });
    return (await r.json()) as {
      books?: { bookFileID: number; educationSubjectID: number; fileDescription: string }[];
      examFiles?: { educationExamFileID: number; educationSubjectID: number; fileDescription: string; examFileType: number }[];
      videos?: { videoID: number; educationSubjectID: number; description: string; videoUrl: string }[];
    };
  });
  const names = subjects.map((s) => s.name);
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  return {
    subjects: subjects.map((s) => ({ ...s, match: matchesSubject(s.name, subject, names) })),
    books: (data.books ?? []).map((b) => ({
      id: b.bookFileID,
      kind: "book",
      title: clean(b.fileDescription),
      subjectId: b.educationSubjectID,
      label: forTeachers ? (b.fileDescription.includes("دليل") ? "دليل المعلم" : b.fileDescription.includes("خطة") ? "خطة توزيع المنهج" : undefined) : undefined,
      url: moeFileUrl("book", b.bookFileID),
    })),
    exams: (data.examFiles ?? []).map((e) => ({
      id: e.educationExamFileID,
      kind: "exam",
      title: clean(e.fileDescription),
      subjectId: e.educationSubjectID,
      label: e.examFileType === 2 ? "أوراق عمل" : "مراجعات",
      url: moeFileUrl("exam", e.educationExamFileID),
    })),
    videos: (data.videos ?? [])
      .filter((v) => /^[\w-]{6,20}$/.test(v.videoUrl))
      .map((v) => ({ id: v.videoID, title: clean(v.description), subjectId: v.educationSubjectID, youtubeId: v.videoUrl })),
    source: `${MOE_BASE}/${forTeachers ? "TeachersLibrary" : "StudentsLibrary"}`,
  };
}

// ===== تحميل ملف PDF واستخراج صفحات منه =====

const CACHE_DIR = path.join(os.tmpdir(), "madrasati-moe-cache");
const MAX_DOWNLOAD = 150 * 1024 * 1024;
export const MAX_PAGES = 20;
const downloads = new Map<string, Promise<string>>();

/** ينزّل الملف مرة وحدة ويحفظه مؤقتاً في السيرفر (أسبوع) */
async function localPdf(kind: "book" | "exam", id: number): Promise<string> {
  const file = path.join(CACHE_DIR, `${kind}-${id}.pdf`);
  try {
    const st = await fs.stat(file);
    if (Date.now() - st.mtimeMs < 7 * DAY && st.size > 0) return file;
  } catch {}
  const k = `${kind}:${id}`;
  const running = downloads.get(k);
  if (running) return running;
  const p = (async () => {
    const res = await fetchExternal(moeFileUrl(kind, id), {}, 180000);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_DOWNLOAD) throw new UserFacingError("الملف كبير جداً.", 413);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== "%PDF-") throw new UserFacingError("الملف مو PDF، ما نقدر نستخدمه مع المساعد.", 415);
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, file);
    return file;
  })().finally(() => downloads.delete(k));
  downloads.set(k, p);
  return p;
}

const docs = new Map<string, Promise<PDFDocument>>();
async function loadDoc(kind: "book" | "exam", id: number) {
  const k = `${kind}:${id}`;
  let p = docs.get(k);
  if (!p) {
    p = localPdf(kind, id).then(async (f) => PDFDocument.load(await fs.readFile(f), { ignoreEncryption: true }));
    p.catch(() => docs.delete(k));
    docs.set(k, p);
    if (docs.size > 3) docs.delete(docs.keys().next().value!);
  }
  try {
    return await p;
  } catch (e) {
    if (e instanceof UserFacingError) throw e;
    throw new UserFacingError("ما قدرنا نقرأ ملف PDF هذا.", 422);
  }
}

export async function moePageCount(kind: "book" | "exam", id: number) {
  return (await loadDoc(kind, id)).getPageCount();
}

/** يرجع صفحات from..to (من ١) كملف PDF جديد صغير */
export async function moePages(kind: "book" | "exam", id: number, from: number, to: number) {
  const src = await loadDoc(kind, id);
  const total = src.getPageCount();
  if (from < 1 || to < from || from > total) throw new UserFacingError(`أرقام الصفحات غير صحيحة. الملف فيه ${total} صفحة.`);
  const end = Math.min(to, total, from + MAX_PAGES - 1);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: end - from + 1 }, (_, i) => from - 1 + i));
  pages.forEach((p) => out.addPage(p));
  return { total, from, to: end, bytes: await out.save() };
}
