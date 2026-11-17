import type Anthropic from "@anthropic-ai/sdk";
import { jsonError, streamTextResponse, UserFacingError } from "@/lib/server/claude";
import { readBody, readContext, readImages, readText, systemPrompt, TASKS, userContent } from "@/lib/server/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_TURNS = 40;

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const ctx = readContext(body);
    const raw = Array.isArray(body.messages) ? body.messages.slice(-MAX_TURNS) : [];
    if (!raw.length) throw new UserFacingError("اكتب سؤالك أول.");

    const messages: Anthropic.Beta.BetaMessageParam[] = raw.map((m: Record<string, unknown>, i: number) => {
      const role = m.role === "assistant" ? "assistant" : "user";
      const isLast = i === raw.length - 1;
      const text = readText(m.text, "الرسالة", { required: role === "user" && isLast }) || (role === "user" ? "(صورة)" : "…");
      // الصور ترسل مع آخر رسالة فقط عشان ما يكبر الطلب
      const images = role === "user" && isLast ? readImages(m.images) : [];
      const hadImages = role === "user" && !isLast && m.hadImages === true;
      return {
        role,
        content: role === "user" ? userContent(hadImages ? `${text}\n\n(أرفقت صورة في هذه الرسالة سابقاً)` : text, images) : text,
      };
    });
    if (messages[0].role !== "user") messages.shift();
    if (messages.at(-1)?.role !== "user") throw new UserFacingError("آخر رسالة لازم تكون من الطالب.");

    return await streamTextResponse({
      system: systemPrompt(ctx, TASKS.chat),
      messages,
      hard: body.hard === true,
      effort: body.hard === true ? "high" : "low",
    });
  } catch (err) {
    return jsonError(err);
  }
}
