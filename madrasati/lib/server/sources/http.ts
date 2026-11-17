import "server-only";
import { UserFacingError } from "../claude";

const UA = "MadrasatiApp/1.0 (educational study assistant)";

/** طلب لموقع خارجي مع مهلة ورسالة خطأ واضحة */
export async function fetchExternal(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new UserFacingError("ما قدرنا نوصل للموقع الخارجي الحين. تأكد من الإنترنت وحاول بعد شوي.", 502);
  }
  if (!res.ok) throw new UserFacingError(`الموقع الخارجي رجّع خطأ (${res.status}). حاول بعد شوي.`, 502);
  return res;
}

/** كاش بسيط في الذاكرة عشان ما نضغط على المواقع */
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
