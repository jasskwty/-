// قوائم مشتركة بين الواجهة والسيرفر

export const GRADES = [
  { id: "6", label: "الصف السادس", stage: "المرحلة المتوسطة" },
  { id: "7", label: "الصف السابع", stage: "المرحلة المتوسطة" },
  { id: "8", label: "الصف الثامن", stage: "المرحلة المتوسطة" },
  { id: "9", label: "الصف التاسع", stage: "المرحلة المتوسطة" },
  { id: "10", label: "الصف العاشر", stage: "المرحلة الثانوية" },
  { id: "11", label: "الصف الحادي عشر", stage: "المرحلة الثانوية" },
  { id: "12", label: "الصف الثاني عشر", stage: "المرحلة الثانوية" },
] as const;

export const SUBJECTS = [
  { id: "math", label: "رياضيات", icon: "➗" },
  { id: "physics", label: "فيزياء", icon: "⚛️" },
  { id: "chemistry", label: "كيمياء", icon: "🧪" },
  { id: "biology", label: "أحياء", icon: "🧬" },
  { id: "arabic", label: "عربي", icon: "📖" },
  { id: "english", label: "English", icon: "🔤" },
  { id: "islamic", label: "إسلامية", icon: "🕌" },
  { id: "social", label: "اجتماعيات", icon: "🌍" },
  { id: "geology", label: "جيولوجيا", icon: "🪨" },
  { id: "psychology", label: "علم نفس", icon: "🧠" },
  { id: "philosophy", label: "فلسفة", icon: "💭" },
  { id: "french", label: "فرنسي", icon: "🇫🇷" },
  { id: "computer", label: "حاسوب", icon: "💻" },
] as const;

export type GradeId = (typeof GRADES)[number]["id"];
export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type ImageMediaType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const PDF_TYPE = "application/pdf";

/** مرفق: صورة أو ملف PDF */
export interface ImageData {
  media_type: ImageMediaType | typeof PDF_TYPE;
  data: string; // base64 بدون البادئة
}

export type Role = "student" | "teacher";

export interface StudyContext {
  grade: GradeId;
  subject: SubjectId;
  role: Role;
  /** مرجع المنهج اللي يحفظه المعلم لهذا الصف والمادة (وضع المعلم فقط) */
  reference?: string;
}

// علامات التحكم داخل البث النصي (تفصلها الواجهة عن النص)
export const CTRL_START = "\u001e";
export const CTRL_END = "\u001f";

export function gradeLabel(id: string) {
  return GRADES.find((g) => g.id === id)?.label ?? "";
}
export function subjectLabel(id: string) {
  return SUBJECTS.find((s) => s.id === id)?.label ?? "";
}
