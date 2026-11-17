import { generateJson, jsonError, UserFacingError } from "@/lib/server/claude";
import { readBody, readContext, readImages, readInt, readText, systemPrompt, TASKS, userContent } from "@/lib/server/prompts";
import { SLIDE_TYPES, type ExamFocus, type FlashcardDeck, type Presentation, type Quiz, type Slide, type SlideType } from "@/lib/types";
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
  slides: {
    type: "array",
    items: obj({
      type: str,
      title: str,
      subtitle: str,
      bullets: { type: "array", items: str },
      notes: str,
      priority: str,
      right_title: str,
      right_items: { type: "array", items: str },
      left_title: str,
      left_items: { type: "array", items: str },
      quiz: { type: "array", items: obj({ question: str, options: { type: "array", items: str }, answer_index: { type: "integer" } }) },
      stats: { type: "array", items: obj({ value: str, label: str }) },
      timer_minutes: { type: "integer" },
      problem: obj({
        statement: str,
        given: { type: "array", items: str },
        required: str,
        steps: { type: "array", items: str },
        answer: str,
        source: str,
      }),
      vectors: { type: "array", items: obj({ label: str, magnitude: { type: "number" }, angle: { type: "number" } }) },
      unit: str,
    }),
  },
});

/** ينظف شريحة وصلت من المساعد ويتأكد إنها سليمة لنوعها */
function cleanSlide(sl: Slide, focus: boolean): Slide {
  const type: SlideType = SLIDE_TYPES.includes(sl.type as SlideType) ? (sl.type as SlideType) : "bullets";
  const arr = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
  const quiz = (sl.quiz ?? [])
    .filter((q) => q.question?.trim() && arr(q.options).length >= 2)
    .map((q) => ({ question: q.question, options: arr(q.options).slice(0, 5), answer_index: Math.min(Math.max(0, q.answer_index | 0), arr(q.options).length - 1) }));
  const out: Slide = {
    type,
    title: sl.title,
    subtitle: sl.subtitle ?? "",
    bullets: arr(sl.bullets),
    notes: sl.notes ?? "",
    priority: focus && PRIORITIES.includes(sl.priority as never) ? sl.priority : "",
    right_title: sl.right_title ?? "",
    right_items: arr(sl.right_items),
    left_title: sl.left_title ?? "",
    left_items: arr(sl.left_items),
    quiz,
    stats: (sl.stats ?? []).filter((x) => x.value?.trim()),
    timer_minutes: Math.min(60, Math.max(0, (sl.timer_minutes ?? 0) | 0)),
    unit: (sl.unit ?? "").slice(0, 20),
    vectors: (sl.vectors ?? [])
      .filter((v) => Number.isFinite(v.magnitude) && v.magnitude > 0 && Number.isFinite(v.angle))
      .slice(0, 4)
      .map((v, i) => ({ label: (v.label || String.fromCharCode(97 + i)).slice(0, 8), magnitude: Math.min(1e6, v.magnitude), angle: ((v.angle % 360) + 360) % 360 })),
    problem:
      sl.problem && sl.problem.statement?.trim()
        ? {
            statement: sl.problem.statement,
            given: arr(sl.problem.given),
            required: sl.problem.required ?? "",
            steps: arr(sl.problem.steps),
            answer: sl.problem.answer ?? "",
            source: sl.problem.source ?? "",
          }
        : undefined,
  };
  // إذا النوع ناقص بياناته، نرجعه نقاط عادية
  if ((type === "quiz" && !quiz.length) || (type === "stats" && !out.stats!.length) || ((type === "compare" || type === "balance") && !out.right_items!.length && !out.left_items!.length))
    out.type = "bullets";
  if (type === "timer" && !out.timer_minutes) out.timer_minutes = 5;
  if (type === "problem" && (!out.problem || !out.problem.steps.length)) out.type = "bullets";
  if (type === "vectors" && out.vectors!.length < 2) out.type = "bullets";
  return out;
}

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
        const content = readText(body.content, "المحتوى", { required: false, max: 15000 });
        const images = readImages(body.images);
        const quizOn = body.quiz !== false;
        const timer = readInt(body.timer, 0, 60, 0);
        const extras = [
          quizOn && "اجعل وحدة من شرائح المحتوى من نوع quiz (٣ أسئلة) قرب النهاية.",
          timer > 0 && `اجعل وحدة من شرائح المحتوى من نوع timer لنشاط مدته ${timer} دقائق مناسب للدرس.`,
          body.varied !== false ? "نوّع أنواع الشرائح حسب المحتوى (مو كلها نقاط)." : "استخدم bullets لكل الشرائح ما عدا الشرائح التفاعلية المطلوبة.",
        ].filter(Boolean);
        const text = `موضوع العرض: ${topic}\nعدد شرائح المحتوى: ${count} بالضبط (بدون شريحة العنوان)\n${extras.join("\n")}${
          content ? `\n\nالمحتوى (استخدمه فقط):\n${content}` : ""
        }${images.length ? "\n\nالمرفقات: محتوى من المستخدم (استخدمه فقط)." : ""}${
          focus ? `\n\nأولويات الاختبار (من تحليل الاختبارات والمراجعات، واعتمدها المستخدم):\n${focus}` : ""
        }`;
        const presentation = await generateJson<Presentation>({
          system: systemPrompt(ctx, ctx.role === "teacher" ? TASKS.teacherPresentation : TASKS.presentation),
          messages: [{ role: "user", content: images.length ? userContent(text, images) : text }],
          schema: SLIDES_SCHEMA,
          maxTokens: 20000,
        });
        presentation.slides = presentation.slides.map((sl) => cleanSlide(sl, !!focus));
        return Response.json(presentation);
      }
      default:
        throw new UserFacingError("الأداة غير معروفة.");
    }
  } catch (err) {
    return jsonError(err);
  }
}
