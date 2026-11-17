import { generateJson, jsonError, UserFacingError } from "@/lib/server/claude";
import { readBody, readContext, readImages, readInt, readText, systemPrompt, TASKS, userContent } from "@/lib/server/prompts";
import type { FlashcardDeck, Presentation, Quiz } from "@/lib/types";

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
  slides: { type: "array", items: obj({ title: str, bullets: { type: "array", items: str }, notes: str }) },
});

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
        const presentation = await generateJson<Presentation>({
          system: systemPrompt(ctx, ctx.role === "teacher" ? TASKS.teacherPresentation : TASKS.presentation),
          messages: [
            {
              role: "user",
              content: `موضوع العرض: ${topic}\nعدد شرائح المحتوى: ${count} بالضبط (بدون شريحة العنوان)`,
            },
          ],
          schema: SLIDES_SCHEMA,
        });
        return Response.json(presentation);
      }
      default:
        throw new UserFacingError("الأداة غير معروفة.");
    }
  } catch (err) {
    return jsonError(err);
  }
}
