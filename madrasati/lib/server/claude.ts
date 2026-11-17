import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CTRL_END, CTRL_START } from "@/lib/constants";

// الموديل الافتراضي، وموديل أقوى للمسائل الصعبة
export const MODEL_DEFAULT = "claude-sonnet-5-5";
export const MODEL_HARD = "claude-opus-5-5";

// إذا رفض الموديل طلباً بالغلط، السيرفر يعيد المحاولة تلقائياً على موديل بديل
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

type Effort = "low" | "medium" | "high";

export class UserFacingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new UserFacingError(
      "ما لقينا مفتاح Claude. أضف ANTHROPIC_API_KEY في ملف ‎.env.local‎ وبعدين أعد تشغيل السيرفر.",
      500,
    );
  }
  client ??= new Anthropic({ maxRetries: 2 });
  return client;
}

/** يحوّل أي خطأ لرسالة عربية واضحة للطالب */
export function toArabicError(err: unknown): { message: string; status: number } {
  if (err instanceof UserFacingError) return { message: err.message, status: err.status };
  if (err instanceof Anthropic.AuthenticationError)
    return { message: "مفتاح Claude غير صحيح أو منتهي. راجع ANTHROPIC_API_KEY في ملف ‎.env.local‎.", status: 401 };
  if (err instanceof Anthropic.PermissionDeniedError)
    return { message: "حسابك ما عنده صلاحية لهذا الموديل. تأكد من إعدادات حسابك في Claude Console.", status: 403 };
  if (err instanceof Anthropic.NotFoundError)
    return { message: "الموديل المطلوب غير متاح حالياً لحسابك.", status: 404 };
  if (err instanceof Anthropic.RateLimitError)
    return { message: "وصلت للحد المسموح من الطلبات. انتظر دقيقة وحاول مرة ثانية.", status: 429 };
  if (err instanceof Anthropic.BadRequestError)
    return {
      message: "ما قدرنا نعالج الطلب. ممكن الصورة كبيرة أو غير واضحة أو النص طويل جداً. جرّب مرة ثانية.",
      status: 400,
    };
  if (err instanceof Anthropic.InternalServerError || (err instanceof Anthropic.APIError && err.status === 529))
    return { message: "خدمة Claude مشغولة الحين. حاول بعد شوي.", status: 503 };
  if (err instanceof Anthropic.APIConnectionTimeoutError)
    return { message: "الطلب أخذ وقت أطول من اللازم. حاول مرة ثانية.", status: 504 };
  if (err instanceof Anthropic.APIConnectionError)
    return { message: "ما قدرنا نتصل بخدمة Claude. تأكد من اتصال الإنترنت.", status: 502 };
  if (err instanceof Anthropic.APIError)
    return { message: `صار خطأ من خدمة Claude (${err.status ?? "?"}). حاول مرة ثانية.`, status: 502 };
  console.error(err);
  return { message: "صار خطأ غير متوقع. حاول مرة ثانية.", status: 500 };
}

export function jsonError(err: unknown) {
  const { message, status } = toArabicError(err);
  return Response.json({ error: message }, { status });
}

const REFUSAL_MSG = "المساعد ما قدر يجاوب على هذا الطلب. جرّب تعيد صياغة سؤالك بشكل ثاني.";

interface RunOptions {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  hard?: boolean;
  effort?: Effort;
  maxTokens?: number;
}

function baseParams(o: RunOptions) {
  return {
    model: o.hard ? MODEL_HARD : MODEL_DEFAULT,
    max_tokens: o.maxTokens ?? 16000,
    system: o.system,
    messages: o.messages,
    output_config: { effort: o.effort ?? (o.hard ? "high" : "medium") },
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
  };
}

type Piece = { text: string } | { reset: true };

async function* streamPieces(o: RunOptions): AsyncGenerator<Piece> {
  const stream = getClient().beta.messages.stream(baseParams(o));
  for await (const event of stream) {
    if (event.type === "content_block_start" && event.content_block.type === "fallback") {
      // الموديل الأول رفض وسط الرد؛ الواجهة تمسح الجزء القديم وتعرض رد البديل
      yield { reset: true };
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { text: event.delta.text };
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new UserFacingError(REFUSAL_MSG);
  if (final.stop_reason === "max_tokens") yield { text: "\n\n> ⚠️ الرد طويل وانقطع. اضغط «اشرح أكثر» للتكملة." };
}

/**
 * يبث الرد كنص عادي. أي خطأ قبل أول حرف يرجع JSON مع كود الحالة،
 * وأي خطأ بعدها يرسل كعلامة تحكم داخل البث.
 */
export async function streamTextResponse(o: RunOptions): Promise<Response> {
  let it: AsyncGenerator<Piece>;
  let first: IteratorResult<Piece>;
  try {
    it = streamPieces(o);
    first = await it.next();
  } catch (err) {
    return jsonError(err);
  }
  const enc = new TextEncoder();
  const encode = (p: Piece) => enc.encode("reset" in p ? `${CTRL_START}RESET${CTRL_END}` : p.text);

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!first.done) controller.enqueue(encode(first.value));
    },
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(encode(value));
      } catch (err) {
        const { message } = toArabicError(err);
        controller.enqueue(enc.encode(`${CTRL_START}ERROR:${message}${CTRL_END}`));
        controller.close();
      }
    },
    cancel() {
      void it.return(undefined);
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

/** طلب يرجع JSON مطابق للـ schema (مخرجات منظمة) */
export async function generateJson<T>(o: RunOptions & { schema: Record<string, unknown> }): Promise<T> {
  const { schema, ...rest } = o;
  const params = baseParams(rest);
  const msg = await getClient().beta.messages.create({
    ...params,
    output_config: { ...params.output_config, format: { type: "json_schema", schema } },
  });
  if (msg.stop_reason === "refusal") throw new UserFacingError(REFUSAL_MSG);
  if (msg.stop_reason === "max_tokens")
    throw new UserFacingError("الطلب كبير جداً. قلل العدد وحاول مرة ثانية.");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UserFacingError("وصل رد غير مكتمل من المساعد. حاول مرة ثانية.", 502);
  }
}
