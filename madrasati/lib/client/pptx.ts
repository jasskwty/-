import type { Presentation, Slide } from "@/lib/types";

const TICK = String.fromCharCode(96);
/** يشيل علامات المعادلات (للمعاينة والنص العادي) */
export const stripTicks = (t: string) => t.split(TICK).join("");
/** للباوربوينت: المعادلة تنعزل باتجاه من اليسار لليمين داخل النص العربي */
const isoMath = (t: string) => t.split(TICK).map((seg, i) => (i % 2 ? "\u2066" + seg + "\u2069" : seg)).join("");

/** محصلة المتجهات (رأس بذيل) */
export function resultant(vs: { magnitude: number; angle: number }[]) {
  let x = 0;
  let y = 0;
  vs.forEach((v) => {
    x += v.magnitude * Math.cos((v.angle * Math.PI) / 180);
    y += v.magnitude * Math.sin((v.angle * Math.PI) / 180);
  });
  return { x, y, r: Math.hypot(x, y), angle: (Math.atan2(y, x) * 180) / Math.PI };
}
const r2 = (n: number) => Math.round(n * 100) / 100;

/** يطبق دالة على كل النصوص داخل كائن */
function mapStrings<T>(v: T, f: (s: string) => string): T {
  if (typeof v === "string") return f(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, f)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, f)])) as T;
  return v;
}

/** يحوّل أي نوع شريحة لنقاط (لملف PowerPoint والمعاينة المختصرة) */
export function slideBullets(s: Slide): string[] {
  switch (s.type) {
    case "compare":
    case "balance":
      return [
        ...(s.right_title ? [`${s.right_title}:`] : []),
        ...(s.right_items ?? []).map((x) => `  ${x}`),
        ...(s.left_title ? [`${s.left_title}:`] : []),
        ...(s.left_items ?? []).map((x) => `  ${x}`),
      ];
    case "stats":
      return (s.stats ?? []).map((x) => `${x.value} — ${x.label}`);
    case "quiz":
      return (s.quiz ?? []).map((q, i) => `${i + 1}. ${q.question} (${q.options.join(" / ")})`);
    case "timer":
      return [`نشاط لمدة ${s.timer_minutes ?? 5} دقائق${s.subtitle ? `: ${s.subtitle}` : ""}`, ...s.bullets];
    case "quote":
      return [s.subtitle || "", ...s.bullets].filter(Boolean);
    case "steps":
      return s.bullets.map((b, i) => `${i + 1}. ${b}`);
    case "problem":
      return s.problem
        ? [
            s.problem.statement,
            ...(s.problem.given.length ? [`المعطيات: ${s.problem.given.join("، ")}`] : []),
            ...(s.problem.required ? [`المطلوب: ${s.problem.required}`] : []),
            ...s.problem.steps.map((st, i) => `${i + 1}) ${st}`),
            ...(s.problem.answer ? [`الجواب: ${s.problem.answer}`] : []),
          ]
        : s.bullets;
    case "vectors": {
      const u = s.unit ? ` ${s.unit}` : "";
      const R = resultant(s.vectors ?? []);
      return [
        ...(s.vectors ?? []).map((v) => `${v.label} = ${r2(v.magnitude)}${u} بزاوية ${r2(v.angle)}°`),
        `المحصلة R = ${r2(R.r)}${u} بزاوية ${r2(R.angle)}°`,
      ];
    }
    default:
      return s.bullets;
  }
}

/** ملاحظات الشريحة، ومعها إجابات الاختبار إذا موجود */
export function slideNotes(s: Slide): string {
  const answers = s.type === "quiz" && s.quiz?.length ? `\nالإجابات: ${s.quiz.map((q, i) => `${i + 1}) ${q.options[q.answer_index]}`).join("  ")}` : "";
  return (s.notes || "") + answers;
}

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
  { id: "modern", name: "مودرن", bg: "0B1023", titleBg: "070A18", titleText: "FFFFFF", heading: "7DD3FC", text: "E6ECFF", accent: "A78BFA" },
  { id: "royal", name: "كحلي ملكي", bg: "F4F7FF", titleBg: "041E52", titleText: "FFFFFF", heading: "0149AD", text: "0B1220", accent: "3B82F6" },
  { id: "ocean", name: "أزرق كلاسيكي", bg: "FFFFFF", titleBg: "1F5BF0", titleText: "FFFFFF", heading: "1A3AB2", text: "1E293B", accent: "599FFF" },
  { id: "desert", name: "رملي دافئ", bg: "FFF8EE", titleBg: "B45309", titleText: "FFFFFF", heading: "92400E", text: "3F2D1C", accent: "F59E0B" },
  { id: "palm", name: "أخضر طبيعي", bg: "F3FBF6", titleBg: "047857", titleText: "FFFFFF", heading: "065F46", text: "1F2937", accent: "34D399" },
  { id: "night", name: "ليلي داكن", bg: "0F172A", titleBg: "020617", titleText: "F8FAFC", heading: "A5B4FC", text: "E2E8F0", accent: "818CF8" },
  { id: "rose", name: "وردي هادئ", bg: "FFF5F7", titleBg: "BE185D", titleText: "FFFFFF", heading: "9D174D", text: "374151", accent: "F472B6" },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

const FONT = "Arial";

function isDarkHex(c: string) {
  const n = parseInt(c, 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
} // خط متوفر في كل الأجهزة ويدعم العربي

export async function downloadPptx(
  p: Presentation,
  opts: { themeId: string; studentName: string; meta: string; bylineLabel?: string },
) {
  p = mapStrings(p, isoMath);
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

  // ===== شرائح المحتوى (كل نوع بتصميمه) =====
  const dark = isDarkHex(t.bg);
  const cardFill = dark ? "1E293B" : "FFFFFF";
  const cardLine = dark ? "334155" : "D9E2F3";
  const X0 = 0.7; // بداية منطقة المحتوى من اليسار
  const BW = W - 1.6; // عرض منطقة المحتوى
  const Y0 = 1.85;
  const BH = H - Y0 - 0.85;
  let num = 1;
  const LETTERS = ["أ", "ب", "ج", "د", "هـ"];

  /** شريحة بإطارها: الخلفية، الشريط الجانبي، العنوان، الشارة، والرقم */
  function frame(s: Slide, title = s.title) {
    const slide = pptx.addSlide();
    num++;
    slide.background = { color: t.bg };
    slide.addShape(pptx.ShapeType.rect, { x: W - 0.25, y: 0, w: 0.25, h: H, fill: { color: t.titleBg } });
    const badge = s.priority === "high" || s.priority === "medium";
    slide.addText(title, {
      ...rtl, x: badge ? 3.0 : X0, y: 0.45, w: W - (badge ? 3.9 : 1.6), h: 1.0, fontSize: 32, bold: true, color: t.heading, align: "right", valign: "middle", fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.rect, { x: W - 3.4, y: 1.5, w: 2.5, h: 0.07, fill: { color: t.accent } });
    if (badge) {
      const high = s.priority === "high";
      slide.addText(high ? "مهم للاختبار" : "يجي أحياناً", {
        ...rtl, x: 0.4, y: 0.3, w: 2.4, h: 0.45, fontSize: 13, bold: true, align: "center", valign: "middle",
        color: high ? "B91C1C" : "92400E", fill: { color: high ? "FEE2E2" : "FEF3C7" }, rectRadius: 0.2, shape: pptx.ShapeType.roundRect,
      });
    }
    slide.addText(`${num}`, { ...rtl, x: 0.4, y: H - 0.7, w: 0.8, h: 0.4, fontSize: 12, color: t.accent, align: "left" });
    return slide;
  }
  const card = (slide: ReturnType<typeof pptx.addSlide>, x: number, y: number, w: number, h: number, fill = cardFill, line = cardLine) =>
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: line, width: 1.25 }, rectRadius: 0.12 });
  const splitCard = (b: string) => {
    const i = b.search(/[:—]/);
    return i > 0 && i < 60 ? [b.slice(0, i).trim(), b.slice(i + 1).trim()] : ["", b];
  };
  const bulletsBox = (slide: ReturnType<typeof pptx.addSlide>, items: string[], x: number, y: number, w: number, h: number, size = 22) =>
    slide.addText(
      items.map((b) => ({ text: b, options: { ...rtl, bullet: { characterCode: "25CF" }, breakLine: true, paraSpaceAfter: 8 } })),
      { ...rtl, x, y, w, h, fontSize: size, color: t.text, align: "right", valign: "top", fit: "shrink", lineSpacingMultiple: 1.12 },
    );

  p.slides.forEach((s) => {
    const type = s.type ?? "bullets";
    const notes = slideNotes(s);

    if (type === "quiz" && s.quiz?.length) {
      // كل سؤال بشريحة، وبعدها شريحة الإجابات
      s.quiz.forEach((q, qi) => {
        const slide = frame(s, `${s.title} — سؤال ${qi + 1} من ${s.quiz!.length}`);
        slide.addText(q.question, { ...rtl, x: X0, y: Y0, w: BW, h: 1.0, fontSize: 26, bold: true, color: t.text, align: "right", valign: "middle", fit: "shrink" });
        const oh = Math.min(0.85, (BH - 1.2) / q.options.length - 0.15);
        q.options.forEach((o, oi) => {
          const y = Y0 + 1.2 + oi * (oh + 0.15);
          card(slide, X0, y, BW, oh);
          slide.addText(`${LETTERS[oi] ?? oi + 1})  ${o}`, { ...rtl, x: X0 + 0.25, y, w: BW - 0.5, h: oh, fontSize: 20, color: t.text, align: "right", valign: "middle", fit: "shrink" });
        });
        slide.addNotes(`الإجابة: ${q.options[q.answer_index]}`);
      });
      const ans = frame(s, `${s.title} — الإجابات`);
      const rh = Math.min(1.2, BH / s.quiz.length - 0.15);
      s.quiz.forEach((q, qi) => {
        const y = Y0 + qi * (rh + 0.15);
        card(ans, X0, y, BW, rh, dark ? "14532D" : "DCFCE7", "16A34A");
        ans.addText(
          [
            { text: `${qi + 1}. ${q.question}`, options: { ...rtl, breakLine: true, color: t.text, fontSize: 18 } },
            { text: `الإجابة الصحيحة: ${q.options[q.answer_index]}`, options: { ...rtl, bold: true, color: dark ? "BBF7D0" : "166534", fontSize: 20 } },
          ],
          { ...rtl, x: X0 + 0.25, y, w: BW - 0.5, h: rh, align: "right", valign: "middle", fit: "shrink" },
        );
      });
      if (notes) ans.addNotes(notes);
      return;
    }

    if (type === "problem" && s.problem) {
      const P = s.problem;
      // شريحة المسألة
      const q = frame(s, `${s.title} — المسألة`);
      card(q, X0, Y0, BW, 2.0);
      q.addText(P.statement, { ...rtl, x: X0 + 0.25, y: Y0 + 0.1, w: BW - 0.5, h: 1.8, fontSize: 22, color: t.text, align: "right", valign: "middle", fit: "shrink" });
      let yy = Y0 + 2.25;
      if (P.given.length) {
        q.addText("المعطيات", { ...rtl, x: X0, y: yy, w: BW, h: 0.45, fontSize: 18, bold: true, color: t.accent, align: "right" });
        const gw = Math.min(3.4, (BW - 0.2 * (P.given.length - 1)) / P.given.length);
        P.given.forEach((g, k) => {
          const x = X0 + BW - (k + 1) * gw - k * 0.2;
          q.addText(g, { ...rtl, x, y: yy + 0.5, w: gw, h: 0.6, fontSize: 17, color: t.text, align: "center", valign: "middle", fit: "shrink", fill: { color: dark ? "1E293B" : "EEF3FF" }, line: { color: cardLine, width: 1 }, rectRadius: 0.3, shape: pptx.ShapeType.roundRect });
        });
        yy += 1.3;
      }
      if (P.required) {
        q.addText([{ text: "المطلوب: ", options: { ...rtl, bold: true, color: t.accent } }, { text: P.required, options: { ...rtl, color: t.text } }], { ...rtl, x: X0, y: yy, w: BW, h: 0.8, fontSize: 19, align: "right", valign: "top", fit: "shrink" });
      }
      if (P.source) q.addText(`المصدر: ${P.source}`, { ...rtl, x: X0 + 1, y: H - 0.75, w: BW - 1, h: 0.4, fontSize: 11, color: t.accent, align: "right", fit: "shrink" });
      if (notes) q.addNotes(notes);
      // شريحة الحل
      const sol = frame(s, `${s.title} — الحل`);
      const n = P.steps.length + (P.answer ? 1 : 0);
      const rh = Math.min(0.8, BH / n - 0.1);
      P.steps.forEach((st, k) => {
        const y = Y0 + k * (rh + 0.1);
        sol.addShape(pptx.ShapeType.ellipse, { x: X0 + BW - rh * 0.8, y: y + rh * 0.1, w: rh * 0.8, h: rh * 0.8, fill: { color: t.heading } });
        sol.addText(`${k + 1}`, { ...rtl, x: X0 + BW - rh * 0.8, y: y + rh * 0.1, w: rh * 0.8, h: rh * 0.8, fontSize: 15, bold: true, color: dark ? "0B1023" : "FFFFFF", align: "center", valign: "middle" });
        card(sol, X0, y, BW - rh, rh);
        sol.addText(st, { ...rtl, x: X0 + 0.2, y, w: BW - rh - 0.4, h: rh, fontSize: 18, color: t.text, align: "right", valign: "middle", fit: "shrink" });
      });
      if (P.answer) {
        const y = Y0 + P.steps.length * (rh + 0.1);
        card(sol, X0, y, BW, rh, dark ? "14532D" : "DCFCE7", "16A34A");
        sol.addText([{ text: "الجواب: ", options: { ...rtl, bold: true } }, { text: P.answer, options: { ...rtl, bold: true } }], { ...rtl, x: X0 + 0.25, y, w: BW - 0.5, h: rh, fontSize: 20, color: dark ? "BBF7D0" : "166534", align: "right", valign: "middle", fit: "shrink" });
      }
      return;
    }

    if (type === "vectors" && (s.vectors?.length ?? 0) >= 2) {
      const vs = s.vectors!;
      const u = s.unit ? ` ${s.unit}` : "";
      const slide = frame(s);
      if (notes) slide.addNotes(notes);
      // النقاط رأس بذيل
      const pts = [[0, 0]];
      vs.forEach((v) => {
        const [px, py] = pts[pts.length - 1];
        pts.push([px + v.magnitude * Math.cos((v.angle * Math.PI) / 180), py + v.magnitude * Math.sin((v.angle * Math.PI) / 180)]);
      });
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const AW = 7.2, AH = BH, AX = X0, AY = Y0;
      card(slide, AX, AY, AW, AH);
      const sc = Math.min((AW - 1.4) / Math.max(maxX - minX, 1e-6), (AH - 1.2) / Math.max(maxY - minY, 1e-6));
      const ox = AX + (AW - (maxX - minX) * sc) / 2;
      const oy = AY + (AH - (maxY - minY) * sc) / 2;
      const map = (q: number[]) => [ox + (q[0] - minX) * sc, oy + (maxY - q[1]) * sc];
      const COLORS = [t.heading, t.accent, "10B981", "F59E0B"];
      const seg = (a: number[], b: number[], color: string, label: string, dash = false) => {
        const [x1, y1] = map(a);
        const [x2, y2] = map(b);
        slide.addShape(pptx.ShapeType.line, {
          x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
          flipH: x2 < x1, flipV: y2 < y1,
          line: { color, width: 3.5, endArrowType: "triangle", ...(dash ? { dashType: "dash" as const } : {}) },
        });
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
        slide.addText(label, { x: (x1 + x2) / 2 + (dy / L) * 0.35 - 1, y: (y1 + y2) / 2 - (dx / L) * 0.35 - 0.2, w: 2, h: 0.4, fontSize: 14, bold: true, color, align: "center", valign: "middle", fontFace: FONT });
      };
      vs.forEach((v, k) => seg(pts[k], pts[k + 1], COLORS[k % COLORS.length], `${v.label} = ${r2(v.magnitude)}${u}`));
      const R = resultant(vs);
      seg(pts[0], pts[pts.length - 1], "E11D48", `R = ${r2(R.r)}${u}`, true);
      // القيم
      const PX = AX + AW + 0.3, PW = BW - AW - 0.3;
      card(slide, PX, AY, PW, AH);
      slide.addText(
        [
          ...vs.map((v, k) => ({ text: `${v.label} = ${r2(v.magnitude)}${u} ، ${r2(v.angle)}°`, options: { ...rtl, breakLine: true, color: COLORS[k % COLORS.length], bold: true } })),
          { text: " ", options: { breakLine: true } },
          { text: `Rx = ${r2(R.x)}   ،   Ry = ${r2(R.y)}`, options: { ...rtl, breakLine: true, color: t.text } },
          { text: `R = ${r2(R.r)}${u}`, options: { ...rtl, breakLine: true, bold: true, color: "E11D48", fontSize: 24 } },
          { text: `α = ${r2(R.angle)}° مع المحور السيني`, options: { ...rtl, color: t.text } },
        ],
        { ...rtl, x: PX + 0.2, y: AY + 0.2, w: PW - 0.4, h: AH - 0.4, fontSize: 17, align: "right", valign: "middle", fit: "shrink", lineSpacingMultiple: 1.3 },
      );
      return;
    }

    const slide = frame(s);
    if (notes) slide.addNotes(notes);
    const sub = s.subtitle && type !== "quote" && type !== "timer" ? s.subtitle : "";
    let y0 = Y0;
    if (sub) {
      slide.addText(sub, { ...rtl, x: X0, y: Y0 - 0.15, w: BW, h: 0.5, fontSize: 16, color: t.accent, align: "right" });
      y0 += 0.45;
    }
    const bh = H - y0 - 0.85;

    if (type === "cards") {
      const items = s.bullets.slice(0, 6);
      const cols = items.length <= 3 ? items.length : items.length === 4 ? 2 : 3;
      const rows = Math.ceil(items.length / cols);
      const gap = 0.3;
      const w = (BW - gap * (cols - 1)) / cols;
      const h = (bh - gap * (rows - 1)) / rows;
      items.forEach((b, k) => {
        const c = k % cols;
        const r = Math.floor(k / cols);
        const x = X0 + BW - (c + 1) * w - c * gap; // من اليمين
        const y = y0 + r * (h + gap);
        card(slide, x, y, w, h);
        slide.addShape(pptx.ShapeType.rect, { x: x + w - 0.12, y: y + 0.2, w: 0.06, h: h - 0.4, fill: { color: t.accent } });
        const [head, body] = splitCard(b);
        slide.addText(
          [
            ...(head ? [{ text: head, options: { ...rtl, bold: true, color: t.heading, fontSize: 22, breakLine: true } }] : []),
            { text: body, options: { ...rtl, color: t.text, fontSize: 17 } },
          ],
          { ...rtl, x: x + 0.2, y: y + 0.1, w: w - 0.45, h: h - 0.2, align: "right", valign: "middle", fit: "shrink" },
        );
      });
    } else if (type === "steps") {
      const items = s.bullets.slice(0, 7);
      const rh = Math.min(0.95, bh / items.length - 0.12);
      items.forEach((b, k) => {
        const y = y0 + k * (rh + 0.12);
        slide.addShape(pptx.ShapeType.ellipse, { x: X0 + BW - rh, y, w: rh, h: rh, fill: { color: t.heading } });
        slide.addText(`${k + 1}`, { ...rtl, x: X0 + BW - rh, y, w: rh, h: rh, fontSize: 20, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
        card(slide, X0, y, BW - rh - 0.2, rh);
        slide.addText(b, { ...rtl, x: X0 + 0.2, y, w: BW - rh - 0.6, h: rh, fontSize: 19, color: t.text, align: "right", valign: "middle", fit: "shrink" });
      });
    } else if (type === "compare" || type === "balance") {
      const gap = 0.4;
      const w = (BW - gap) / 2;
      const cols: [string, string[], string, number][] = [
        [s.right_title ?? "", s.right_items ?? [], t.heading, X0 + w + gap],
        [s.left_title ?? "", s.left_items ?? [], t.titleBg, X0],
      ];
      cols.forEach(([head, items, color, x]) => {
        slide.addText(head, { ...rtl, x, y: y0, w, h: 0.7, fontSize: 22, bold: true, color: "FFFFFF", align: "center", valign: "middle", fill: { color }, rectRadius: 0.12, shape: pptx.ShapeType.roundRect });
        card(slide, x, y0 + 0.85, w, bh - 0.85);
        bulletsBox(slide, items, x + 0.2, y0 + 1.0, w - 0.4, bh - 1.1, 19);
      });
      if (type === "balance") {
        // رمز الميزان: عمود ومثلث في النص
        slide.addShape(pptx.ShapeType.triangle, { x: X0 + w + gap / 2 - 0.18, y: y0 + bh - 0.35, w: 0.36, h: 0.3, fill: { color: t.accent } });
        slide.addShape(pptx.ShapeType.rect, { x: X0 + w + gap / 2 - 0.03, y: y0 + 0.85, w: 0.06, h: bh - 1.2, fill: { color: t.accent } });
      }
    } else if (type === "stats" && s.stats?.length) {
      const items = s.stats.slice(0, 4);
      const gap = 0.35;
      const w = (BW - gap * (items.length - 1)) / items.length;
      const h = Math.min(3.2, bh);
      const y = y0 + (bh - h) / 2;
      items.forEach((st, k) => {
        const x = X0 + BW - (k + 1) * w - k * gap;
        card(slide, x, y, w, h);
        slide.addText(st.value, { ...rtl, x, y: y + 0.2, w, h: h * 0.55, fontSize: 54, bold: true, color: t.heading, align: "center", valign: "middle", fit: "shrink" });
        slide.addText(st.label, { ...rtl, x: x + 0.15, y: y + h * 0.58, w: w - 0.3, h: h * 0.38, fontSize: 18, color: t.text, align: "center", valign: "top", fit: "shrink" });
      });
    } else if (type === "quote") {
      slide.addShape(pptx.ShapeType.rect, { x: X0 + BW - 0.1, y: y0 + 0.4, w: 0.1, h: 2.2, fill: { color: t.accent } });
      slide.addText(`«${s.subtitle || s.bullets[0] || ""}»`, { ...rtl, x: X0, y: y0 + 0.2, w: BW - 0.4, h: 2.6, fontSize: 34, bold: true, color: t.heading, align: "center", valign: "middle", fit: "shrink" });
      const rest = s.subtitle ? s.bullets : s.bullets.slice(1);
      if (rest.length) bulletsBox(slide, rest, X0, y0 + 3.0, BW, bh - 3.0, 18);
    } else if (type === "timer") {
      const m = Math.max(1, s.timer_minutes ?? 5);
      card(slide, X0 + BW / 2 - 2.6, y0, 5.2, 2.2);
      slide.addText(`${String(m).padStart(2, "0")}:00`, { x: X0 + BW / 2 - 2.6, y: y0, w: 5.2, h: 1.6, fontSize: 80, bold: true, color: t.heading, align: "center", valign: "middle", fontFace: FONT });
      slide.addText("دقائق للنشاط", { ...rtl, x: X0 + BW / 2 - 2.6, y: y0 + 1.5, w: 5.2, h: 0.6, fontSize: 18, color: t.text, align: "center" });
      if (s.subtitle) slide.addText(s.subtitle, { ...rtl, x: X0, y: y0 + 2.35, w: BW, h: 0.7, fontSize: 22, bold: true, color: t.text, align: "center", fit: "shrink" });
      if (s.bullets.length) bulletsBox(slide, s.bullets, X0 + 1, y0 + 3.1, BW - 2, bh - 3.1, 18);
    } else {
      bulletsBox(slide, slideBullets(s), X0, y0, BW, bh);
    }
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
