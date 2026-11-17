import type { Presentation } from "@/lib/types";

export interface SlideTheme {
  id: string;
  name: string;
  bg: string; // خلفية الشرائح
  titleBg: string; // خلفية شريحة العنوان
  titleText: string; // لون النص على شريحة العنوان
  heading: string; // لون عناوين الشرائح
  text: string;
  accent: string;
}

// الألوان بدون # (صيغة pptxgenjs)
export const THEMES: SlideTheme[] = [
  { id: "ocean", name: "أزرق كلاسيكي", bg: "FFFFFF", titleBg: "1F5BF0", titleText: "FFFFFF", heading: "1A3AB2", text: "1E293B", accent: "599FFF" },
  { id: "desert", name: "رملي دافئ", bg: "FFF8EE", titleBg: "B45309", titleText: "FFFFFF", heading: "92400E", text: "3F2D1C", accent: "F59E0B" },
  { id: "palm", name: "أخضر طبيعي", bg: "F3FBF6", titleBg: "047857", titleText: "FFFFFF", heading: "065F46", text: "1F2937", accent: "34D399" },
  { id: "night", name: "ليلي داكن", bg: "0F172A", titleBg: "020617", titleText: "F8FAFC", heading: "A5B4FC", text: "E2E8F0", accent: "818CF8" },
  { id: "rose", name: "وردي هادئ", bg: "FFF5F7", titleBg: "BE185D", titleText: "FFFFFF", heading: "9D174D", text: "374151", accent: "F472B6" },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

const FONT = "Arial"; // خط متوفر في كل الأجهزة ويدعم العربي

export async function downloadPptx(
  p: Presentation,
  opts: { themeId: string; studentName: string; meta: string; bylineLabel?: string },
) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const t = themeById(opts.themeId);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 16:9 — ‎13.33 × 7.5 إنش
  pptx.rtlMode = true;
  pptx.title = p.title;
  pptx.subject = opts.meta;
  if (opts.studentName) pptx.author = opts.studentName;

  const W = 13.333;
  const H = 7.5;
  const rtl = { rtlMode: true, lang: "ar-SA", fontFace: FONT } as const;

  // ===== شريحة العنوان =====
  const title = pptx.addSlide();
  title.background = { color: t.titleBg };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.35, w: W, h: 0.35, fill: { color: t.accent } });
  title.addShape(pptx.ShapeType.rect, { x: W - 1.2, y: 2.35, w: 0.12, h: 2.2, fill: { color: t.accent } });
  title.addText(p.title, {
    ...rtl, x: 0.8, y: 2.1, w: W - 2.3, h: 1.6, fontSize: 44, bold: true, color: t.titleText, align: "right", valign: "middle", fit: "shrink",
  });
  title.addText(p.subtitle, {
    ...rtl, x: 0.8, y: 3.7, w: W - 2.3, h: 0.9, fontSize: 24, color: t.titleText, align: "right", valign: "top", transparency: 10,
  });
  const byline = [opts.studentName && `${opts.bylineLabel ?? "إعداد الطالب"}: ${opts.studentName}`, opts.meta].filter(Boolean).join("   •   ");
  title.addText(byline, { ...rtl, x: 0.8, y: 5.6, w: W - 2.3, h: 0.6, fontSize: 16, color: t.titleText, align: "right" });
  title.addNotes(`عرض بعنوان: ${p.title}. ${p.subtitle}`);

  // ===== شرائح المحتوى =====
  p.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: t.bg };
    slide.addShape(pptx.ShapeType.rect, { x: W - 0.25, y: 0, w: 0.25, h: H, fill: { color: t.titleBg } });
    slide.addText(s.title, {
      ...rtl, x: 0.7, y: 0.45, w: W - 1.6, h: 1.0, fontSize: 32, bold: true, color: t.heading, align: "right", valign: "middle", fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.rect, { x: W - 3.4, y: 1.5, w: 2.5, h: 0.07, fill: { color: t.accent } });
    slide.addText(
      s.bullets.map((b) => ({
        text: b,
        options: { bullet: { characterCode: "25CF" }, breakLine: true, paraSpaceAfter: 10 },
      })),
      { ...rtl, x: 0.7, y: 1.85, w: W - 1.6, h: H - 2.7, fontSize: 22, color: t.text, align: "right", valign: "top", fit: "shrink", lineSpacingMultiple: 1.15 },
    );
    slide.addText(`${i + 2}`, { ...rtl, x: 0.4, y: H - 0.7, w: 0.8, h: 0.4, fontSize: 12, color: t.accent, align: "left" });
    if (s.notes) slide.addNotes(s.notes);
  });

  // ===== شريحة الختام =====
  const end = pptx.addSlide();
  end.background = { color: t.titleBg };
  end.addText("شكراً لحسن استماعكم", { ...rtl, x: 0.5, y: 2.6, w: W - 1, h: 1.3, fontSize: 44, bold: true, color: t.titleText, align: "center" });
  if (opts.studentName)
    end.addText(opts.studentName, { ...rtl, x: 0.5, y: 3.9, w: W - 1, h: 0.7, fontSize: 22, color: t.titleText, align: "center" });
  end.addNotes("الختام: اشكر الحضور وافتح المجال للأسئلة.");

  const safe = p.title.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 60) || "عرض";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
