// مطابقة أسماء المواد في المواقع الخارجية مع مواد التطبيق

export function normalizeAr(s: string) {
  return s
    .replace(/[ً-ْـ]/g, "") // التشكيل والتطويل
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// كلمات مفتاحية لكل مادة (بعد التطبيع)
const KEYWORDS: Record<string, string[]> = {
  math: ["رياضيات", "احصاء"],
  physics: ["فيزياء"],
  chemistry: ["كيمياء"],
  biology: ["احياء"],
  arabic: ["عربي", "العربيه", "لغتي", "النحو", "البلاغه"],
  english: ["انجليزي", "english"],
  islamic: ["اسلامي", "القران"],
  social: ["اجتماعيات", "دوله الكويت", "تاريخ", "جغرافيا", "دستور", "قضايا البيئه"],
  geology: ["جيولوجيا", "علوم الارض"],
  psychology: ["علم نفس", "علم النفس", "الصحه النفسيه"],
  philosophy: ["فلسفه"],
  french: ["فرنسي", "الفرنسيه"],
  computer: ["حاسوب", "تقنيه المعلومات", "الذكاء الرقمي"],
};
// مواد المرحلة المتوسطة اللي اسمها «العلوم»
const SCIENCE = ["physics", "chemistry", "biology", "geology"];

/** يرجع true إذا اسم المادة الخارجي يطابق مادة التطبيق */
export function matchesSubject(externalName: string, subjectId: string, allNames: string[] = []): boolean {
  const n = normalizeAr(externalName);
  if ((KEYWORDS[subjectId] ?? []).some((k) => n.includes(k))) return true;
  // «العلوم» أو «علوم» للمواد العلمية إذا ما فيه مادة أدق في نفس الصف
  if (SCIENCE.includes(subjectId) && /(^|\s)(ال)?علوم(\s|$)/.test(n) && !n.includes("ارض")) {
    const specific = allNames.some((o) => (KEYWORDS[subjectId] ?? []).some((k) => normalizeAr(o).includes(k)));
    return !specific;
  }
  return false;
}
