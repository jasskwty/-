import { CTRL_END, CTRL_START } from "@/lib/constants";

/** يفصل النص عن علامات التحكم القادمة من السيرفر */
function parse(raw: string): { text: string; error?: string } {
  let text = "";
  let error: string | undefined;
  let i = 0;
  while (i < raw.length) {
    const s = raw.indexOf(CTRL_START, i);
    if (s === -1) {
      text += raw.slice(i);
      break;
    }
    text += raw.slice(i, s);
    const e = raw.indexOf(CTRL_END, s);
    if (e === -1) break; // علامة لسه ما وصلت كاملة
    const ctrl = raw.slice(s + 1, e);
    if (ctrl === "RESET") text = "";
    else if (ctrl.startsWith("ERROR:")) error = ctrl.slice(6);
    i = e + 1;
  }
  return { text, error };
}

async function errorFrom(res: Response): Promise<Error> {
  try {
    const j = await res.json();
    if (j?.error) return new Error(j.error);
  } catch {}
  if (res.status === 413) return new Error("الملف أو الصورة كبيرة جداً.");
  return new Error(`صار خطأ في السيرفر (${res.status}). حاول مرة ثانية.`);
}

function networkError(err: unknown): Error {
  if (err instanceof DOMException && err.name === "AbortError") return err as Error;
  if (err instanceof Error && err.message && !(err instanceof TypeError)) return err;
  return new Error("ما قدرنا نتصل بالسيرفر. تأكد إن التطبيق شغال واتصالك بالإنترنت سليم.");
}

/** يرسل طلب ويستقبل الرد أول بأول */
export async function streamPost(
  url: string,
  body: unknown,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw networkError(err);
  }
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      const { text, error } = parse(raw);
      if (error) throw new Error(error);
      onText(text);
    }
  } catch (err) {
    throw networkError(err);
  }
  raw += decoder.decode();
  const { text, error } = parse(raw);
  if (error) throw new Error(error);
  if (!text.trim()) throw new Error("وصل رد فاضي. حاول مرة ثانية.");
  onText(text);
  return text;
}

export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw networkError(err);
  }
  if (!res.ok) throw await errorFrom(res);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("وصل رد غير مفهوم من السيرفر.");
  }
}
