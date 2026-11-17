// طلبات مصادر المكتبات من سيرفر التطبيق
import { postJson } from "./stream";

export interface MoeItem {
  id: number;
  kind: "book" | "exam";
  title: string;
  subjectId: number;
  label?: string;
  url: string;
}
export interface MoeCatalog {
  subjects: { id: number; name: string; match: boolean }[];
  books: MoeItem[];
  exams: MoeItem[];
  videos: { id: number; title: string; subjectId: number; youtubeId: string }[];
  source: string;
}
export interface SkwSubjects {
  subjects: { id: number; name: string; match: boolean }[];
  source: string;
}
export interface SkwFiles {
  title: string;
  source: string;
  files: { id: number; title: string; type: string; url: string }[];
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("ما قدرنا نتصل بالسيرفر.");
  }
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error ?? `صار خطأ (${res.status}).`);
  return j as T;
}

const catalogs = new Map<string, Promise<MoeCatalog>>();
export function moeCatalog(grade: string, term: number, forTeachers: boolean, subject: string) {
  const k = `${grade}:${term}:${forTeachers}:${subject}`;
  let p = catalogs.get(k);
  if (!p) {
    p = getJson<MoeCatalog>(`/api/sources/moe?grade=${grade}&term=${term}&subject=${subject}${forTeachers ? "&for=teacher" : ""}`);
    p.catch(() => catalogs.delete(k));
    catalogs.set(k, p);
  }
  return p;
}

export const skwSubjects = (grade: string, term: number, subject: string) =>
  getJson<SkwSubjects>(`/api/sources/schoolkw?grade=${grade}&term=${term}&subject=${subject}`);
export const skwFiles = (section: number, term: number) => getJson<SkwFiles>(`/api/sources/schoolkw?section=${section}&term=${term}`);

export const moePageCount = (kind: string, id: number) => postJson<{ total: number; maxPages: number }>("/api/sources/moe/pages", { kind, id });
export const moePages = (kind: string, id: number, from: number, to: number) =>
  postJson<{ total: number; from: number; to: number; data: string }>("/api/sources/moe/pages", { kind, id, from, to });
