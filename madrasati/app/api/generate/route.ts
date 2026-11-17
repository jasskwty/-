import { jsonError, streamTextResponse, UserFacingError } from "@/lib/server/claude";
import { readBody, readContext, readImages, readInt, readText, systemPrompt, TASKS, userContent } from "@/lib/server/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const TEXT_TOOLS = ["explain", "solve", "summarize", "essay", "schedule", "more"] as const;
type TextTool = (typeof TEXT_TOOLS)[number];

function buildRequest(tool: TextTool, body: Record<string, unknown>): { text: string; withImages: boolean } {
  switch (tool) {
    case "explain": {
      const topic = readText(body.input, "اسم الدرس أو الموضوع", { max: 2000 });
      return { text: `اشرح لي درس: ${topic}`, withImages: false };
    }
    case "solve": {
      const input = readText(body.input, "نص السؤال", { required: false });
      return { text: input ? `حل هذا الواجب:\n\n${input}` : "حل الواجب الموجود في الصورة.", withImages: true };
    }
    case "summarize": {
      const input = readText(body.input, "النص", { required: false });
      return { text: input ? `لخّص هذا المحتوى:\n\n${input}` : "لخّص المحتوى الموجود في الصورة.", withImages: true };
    }
    case "essay": {
      const input = readText(body.input, "التعبير", { required: false });
      const topic = readText(body.topic, "عنوان التعبير", { required: false, max: 300 });
      return {
        text: `${topic ? `عنوان التعبير: ${topic}\n\n` : ""}${input ? `صحّح تعبيري:\n\n${input}` : "صحّح التعبير الموجود في الصورة."}`,
        withImages: true,
      };
    }
    case "schedule": {
      const exams = Array.isArray(body.exams) ? body.exams : [];
      const lines = exams
        .map((e: Record<string, unknown>) => {
          const subject = readText(e.subject, "اسم المادة", { required: false, max: 80 });
          const date = readText(e.date, "التاريخ", { required: false, max: 20 });
          const level = readText(e.level, "الصعوبة", { required: false, max: 20 });
          return subject && date ? `- ${subject}: ${date}${level ? ` (صعوبتها عندي: ${level})` : ""}` : "";
        })
        .filter(Boolean);
      if (!lines.length) throw new UserFacingError("أضف اختبار واحد على الأقل مع المادة والتاريخ.");
      const hours = readInt(body.hours, 1, 12, 3);
      const today = readText(body.today, "تاريخ اليوم", { max: 20 }) || new Date().toISOString().slice(0, 10);
      const notes = readText(body.input, "الملاحظات", { required: false, max: 1500 });
      return {
        text: `تاريخ اليوم: ${today}\nساعات المذاكرة اليومية: ${hours} ساعات\n\nمواعيد الاختبارات:\n${lines.join("\n")}${notes ? `\n\nملاحظات: ${notes}` : ""}`,
        withImages: false,
      };
    }
    case "more": {
      const previous = readText(body.previous, "الرد السابق", { max: 40000 });
      const request = readText(body.request, "الطلب الأصلي", { required: false, max: 4000 });
      return {
        text: `${request ? `طلبي الأصلي كان:\n${request}\n\n` : ""}وهذا الرد اللي وصلني:\n<previous>\n${previous}\n</previous>\n\nاشرح لي أكثر.`,
        withImages: false,
      };
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const ctx = readContext(body);
    const tool = TEXT_TOOLS.find((t) => t === body.tool);
    if (!tool) throw new UserFacingError("الأداة غير معروفة.");

    const { text, withImages } = buildRequest(tool, body);
    const images = withImages ? readImages(body.images) : [];
    if (withImages && !images.length && !readText(body.input, "النص", { required: false }))
      throw new UserFacingError("اكتب النص أو ارفع صورة أول.");

    return await streamTextResponse({
      system: systemPrompt(ctx, TASKS[tool]),
      messages: [{ role: "user", content: userContent(text, images) }],
      hard: body.hard === true,
    });
  } catch (err) {
    return jsonError(err);
  }
}
