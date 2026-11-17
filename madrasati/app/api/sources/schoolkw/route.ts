import { jsonError, UserFacingError } from "@/lib/server/claude";
import { skwFiles, skwSubjects } from "@/lib/server/sources/schoolkw";

export const runtime = "nodejs";

// فهرس موقع مدرستي: ?grade=&term=&subject= للمواد، أو ?section=&term= للملفات
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const term = q.get("term") === "2" ? 2 : 1;
    const sectionId = Number(q.get("section"));
    if (sectionId > 0) return Response.json(await skwFiles(sectionId, term));
    const grade = q.get("grade");
    if (!grade) throw new UserFacingError("اختر الصف أول.");
    return Response.json(await skwSubjects(grade, term, q.get("subject") ?? ""));
  } catch (err) {
    return jsonError(err);
  }
}
