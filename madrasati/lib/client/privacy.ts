// حماية الخصوصية: الأسماء الحقيقية ما تطلع من جهاز المعلم.
// نرسل رموز (S1، S2، [اسم الطالب]) ونرجّع الأسماء في العرض فقط.

export type Aliases = Record<string, string>; // الرمز ← الاسم الحقيقي

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** يبدّل الرموز بالأسماء الحقيقية (للعرض والنسخ والطباعة) */
export function applyAliases(text: string, aliases?: Aliases): string {
  if (!aliases) return text;
  const codes = Object.keys(aliases).filter((c) => aliases[c]);
  if (!codes.length) return text;
  // الأطول أول عشان S12 ما يتبدل كـ S1
  codes.sort((a, b) => b.length - a.length);
  const re = new RegExp(codes.map((c) => (/^\w+$/.test(c) ? `\\b${escape(c)}\\b` : escape(c))).join("|"), "g");
  return text.replace(re, (m) => aliases[m] ?? m);
}

/** يخفي الأسماء من نص حر قبل إرساله (مثلاً ملاحظات المعلم) */
export function hideNames(text: string, aliases: Aliases): string {
  let out = text;
  const pairs = Object.entries(aliases)
    .filter(([, name]) => name.trim().length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [code, name] of pairs) out = out.split(name.trim()).join(code);
  return out;
}
