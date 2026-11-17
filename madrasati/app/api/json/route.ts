import { generateJson, jsonError, UserFacingError } from "@/lib/server/claude";
import { readBody, readContext, readInt, readText, systemPrompt, TASKS } from "@/lib/server/prompts";
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

const DIFFICULTY: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const ctx = readContext(body);
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
