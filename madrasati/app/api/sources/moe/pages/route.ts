import { jsonError, UserFacingError } from "@/lib/server/claude";
import { MAX_PAGES, moePageCount, moePages } from "@/lib/server/sources/moe";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { kind: "book" | "exam", id, from?, to? }
 * بدون from/to: يرجع عدد الصفحات فقط.
 * مع from/to: يرجع الصفحات المطلوبة كملف PDF (base64) عشان ترفق مع المساعد.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const kind = body?.kind === "exam" ? "exam" : body?.kind === "book" ? "book" : null;
    const id = Math.trunc(Number(body?.id));
    if (!kind || !Number.isFinite(id) || id <= 0) throw new UserFacingError("الملف غير معروف.");
    if (body?.from == null) return Response.json({ total: await moePageCount(kind, id), maxPages: MAX_PAGES });
    const from = Math.trunc(Number(body.from));
    const to = Math.trunc(Number(body.to ?? body.from));
    const r = await moePages(kind, id, from, to);
    return Response.json({ total: r.total, from: r.from, to: r.to, data: Buffer.from(r.bytes).toString("base64") });
  } catch (err) {
    return jsonError(err);
  }
}
