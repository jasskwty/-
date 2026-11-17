import { generateJson, jsonError, UserFacingError } from "@/lib/server/claude";
import { readBody, readContext, readImages, readInt, readText, systemPrompt, TASKS, userContent } from "@/lib/server/prompts";
import type { ExamFocus, FlashcardDeck, Presentation, Quiz } from "@/lib/types";
import { PDF_TYPE, type ImageData } from "@/lib/constants";
import { MAX_PAGES, moePages } from "@/lib/server/sources/moe";

export const runtime = "nodejs";
export const maxDuration = 300;

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const QUIZ_SCHEMA = obj({
  title: str,
  questions: {
    type: "array",
    items: obj({
      question: str,
      options: { type: "array", items: str },
      correct_index: { type: "integer" },
      explanation: str,
    }),
  },
});

const CARDS_SCHEMA = obj({
  title: str,
  cards: { type: "array", items: obj({ front: str, back: str }) },
});

const SLIDES_SCHEMA = obj({
  title: str,
  subtitle: str,
  slides: { type: "array", items: obj({ title: str, bullets: { type: "array", items: str }, notes: str, priority: str }) },
});

const FOCUS_SCHEMA = obj({
  lesson: str,
  coverage: str,
  items: {
    type: "array",
    items: obj({
      topic: str,
      priority: str,
      count: { type: "integer" },
      question_types: { type: "array", items: str },
      sources: str,
      tip: str,
    }),
  },
  sample_questions: { type: "array", items: str },
  warnings: str,
});
const PRIORITIES = ["high", "medium", "low"] as const;
const P_LABEL: Record<string, string> = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
const SECONDARY = ["10", "11", "12"];

/** أولويات الاختبار اللي اعتمدها المستخدم، كنص مختصر للمساعد */
function focusText(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v
    .slice(0, 40)
    .map((it: Record<string, unknown>) => {
      const topic = typeof it.topic === "string" ? it.topic.trim().slice(0, 200) : "";
      const pr = PRIORITIES.includes(it.priority as never) ? (it.priority as string) : "medium";
      const types = Array.isArray(it.question_types) ? it.question_types.filter((x) => typeof x === "string").slice(0, 6).join("، ") : "";
      const count = Math.max(0, Math.min(999, Number(it.count) || 0));
      return topic ? `- [${P_LABEL[pr]}] ${topic} (ظهر ${count} مرة${types ? `، أسئلة: ${types}` : ""})` : "";
    })
    .filter(Boolean)
    .join("\n");
}

const ROSTER_SCHEMA = obj({
  classes: {
    type: "array",
    items: obj({ name: str, grade: str, students: { type: "array", items: str }, unclear: { type: "array", items: str } }),
  },
  warnings: str,
});
interface Roster {
  classes: { name: string; grade: string; students: string[]; unclear: string[] }[];
  warnings: string;
}
const GRADES_OK = ["6", "7", "8", "9", "10", "11", "12"];
// احتياط: نشيل أي رقم طويل (مثل الرقم المدني أو الهاتف) لو وصل بالغلط
const cleanName = (n: string) => n.replace(/[0-9٠-٩]{4,}/g, "").replace(/\s+/g, " ").trim();

const DIFFICULTY: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const ctx = readContext(body);

    // حصر الدرس في الاختبارات (المرحلة الثانوية)
    if (body.tool === "examFocus") {
      if (!SECONDARY.includes(ctx.grade)) throw new UserFacingError("تحليل الاختبارات متاح للمرحلة الثانوية (العاشر إلى الثاني عشر).");
      const topic = readText(body.topic, "اسم الدرس", { max: 500 });
      const docs: ImageData[] = [];
      const names: string[] = [];
      const moe = Array.isArray(body.moeFiles) ? body.moeFiles.slice(0, 4) : [];
      for (const f of moe as Record<string, unknown>[]) {
        const id = Math.trunc(Number(f.id));
        if (!(id > 0)) continue;
        const from = Math.max(1, Math.trunc(Number(f.from) || 1));
        const pages = await moePages("exam", id, from, Math.trunc(Number(f.to) || from + MAX_PAGES - 1));
        docs.push({ media_type: PDF_TYPE, data: Buffer.from(pages.bytes).toString("base64") });
        names.push(`مرفق ${docs.length}: ${typeof f.title === "string" ? f.title.slice(0, 120) : "ملف وزارة"} (ص ${pages.from}–${pages.to} من ${pages.total})`);
      }
      const uploads = readImages(body.images, 4);
      uploads.forEach((u) => {
        docs.push(u);
        names.push(`مرفق ${docs.length}: ملف رفعه المستخدم`);
      });
      if (!docs.length) throw new UserFacingError("اختر ملف مراجعة أو اختبار واحد على الأقل، أو ارفع اختبارات سابقة.");
      const focus = await generateJson<ExamFocus>({
        system: systemPrompt({ ...ctx, reference: ctx.reference }, TASKS.examFocus),
        messages: [{ role: "user", content: userContent(`الدرس: ${topic}\n\nالمرفقات:\n${names.join("\n")}`, docs) }],
        schema: FOCUS_SCHEMA,
        hard: true,
        maxTokens: 20000,
      });
      const rank = { high: 0, medium: 1, low: 2 } as const;
      focus.items = focus.items
        .filter((i) => i.topic?.trim())
        .map((i) => ({ ...i, priority: PRIORITIES.includes(i.priority) ? i.priority : "medium", count: Math.max(0, i.count | 0) }))
        .sort((a, b) => rank[a.priority] - rank[b.priority] || b.count - a.count);
      return Response.json(focus);
    }

    // قراءة كشف الطلاب من الصور (وضع المعلم)
    if (body.tool === "roster") {
      const images = readImages(body.images, 8);
      if (!images.length) throw new UserFacingError("صوّر الكشف أو ارفع ملفه أول.");
      const roster = await generateJson<Roster>({
        system: systemPrompt({ ...ctx, role: "teacher", reference: "" }, TASKS.roster),
        messages: [{ role: "user", content: userContent(`اقرأ ${images.length > 1 ? `هذي الكشوف (${images.length} مرفقات)` : "هذا الكشف"} واستخرج أسماء الطلاب لكل فصل.`, images) }],
        schema: ROSTER_SCHEMA,
        hard: true, // قراءة الخط والأسماء تحتاج دقة
      });
      roster.classes = roster.classes
        .map((c, i) => {
          const seen = new Set<string>();
          const students = c.students.map(cleanName).filter((n) => n.length > 1 && !seen.has(n) && seen.add(n));
          return {
            name: c.name.trim().slice(0, 40) || `فصل ${i + 1}`,
            grade: GRADES_OK.includes(c.grade.trim()) ? c.grade.trim() : "",
            students,
            unclear: (c.unclear ?? []).map(cleanName).filter(Boolean),
          };
        })
        .filter((c) => c.students.length > 0);
      if (!roster.classes.length)
        throw new UserFacingError(roster.warnings || "ما قدرنا نقرأ أسماء من الصورة. صوّر الكشف بشكل أوضح وبإضاءة أفضل.", 422);
      return Response.json(roster);
    }

    const topic = readText(body.topic, "الموضوع", { max: 2000 });

    switch (body.tool) {
      case "quiz": {
        const count = readInt(body.count, 3, 20, 5);
        const difficulty = DIFFICULTY[String(body.difficulty)] ?? "متوسط";
        const quiz = await generateJson<Quiz>({
          system: systemPrompt(ctx, TASKS.quiz),
          messages: [{ role: "user", content: `الموضوع: ${topic}\nعدد الأسئلة: ${count} بالضبط\nمستوى الصعوبة: ${difficulty}` }],
          schema: QUIZ_SCHEMA,
          hard: difficulty === "صعب",
        });
        // تأكد إن كل سؤال سليم قبل ما نرجعه للواجهة
        quiz.questions = quiz.questions.filter(
          (q) => q.options.length >= 2 && q.correct_index >= 0 && q.correct_index < q.options.length,
        );
        if (!quiz.questions.length) throw new UserFacingError("ما قدرنا نجهز أسئلة. جرّب موضوع ثاني.", 502);
        return Response.json(quiz);
      }
      case "flashcards": {
        const count = readInt(body.count, 4, 30, 10);
        const deck = await generateJson<FlashcardDeck>({
          system: systemPrompt(ctx, TASKS.flashcards),
          messages: [{ role: "user", content: `الموضوع: ${topic}\nعدد البطاقات: ${count} بالضبط` }],
          schema: CARDS_SCHEMA,
        });
        return Response.json(deck);
      }
      case "presentation": {
        const count = readInt(body.count, 3, 15, 6);
        const focus = focusText(body.focus);
        const presentation = await generateJson<Presentation>({
          system: systemPrompt(ctx, ctx.role === "teacher" ? TASKS.teacherPresentation : TASKS.presentation),
          messages: [
            {
              role: "user",
              content: `موضوع العرض: ${topic}\nعدد شرائح المحتوى: ${count} بالضبط (بدون شريحة العنوان)${
                focus ? `\n\nأولويات الاختبار (من تحليل الاختبارات والمراجعات، واعتمدها المستخدم):\n${focus}` : ""
              }`,
            },
          ],
          schema: SLIDES_SCHEMA,
        });
        presentation.slides = presentation.slides.map((sl) => ({
          ...sl,
          priority: focus && PRIORITIES.includes(sl.priority as never) ? sl.priority : "",
        }));
        return Response.json(presentation);
      }
      default:
        throw new UserFacingError("الأداة غير معروفة.");
    }
  } catch (err) {
    return jsonError(err);
  }
}
