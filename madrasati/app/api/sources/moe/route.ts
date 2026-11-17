import { jsonError, UserFacingError } from "@/lib/server/claude";
import { moeCatalog } from "@/lib/server/sources/moe";

export const runtime = "nodejs";

// فهرس مكتبة وزارة التربية لصف وفصل دراسي
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const grade = q.get("grade") ?? "";
    const term = q.get("term") === "2" ? 2 : 1;
    const subject = q.get("subject") ?? "";
    if (!grade) throw new UserFacingError("اختر الصف أول.");
    return Response.json(await moeCatalog(grade, term, q.get("for") === "teacher", subject));
  } catch (err) {
    return jsonError(err);
  }
}
