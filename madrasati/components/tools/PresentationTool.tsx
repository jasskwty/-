"use client";
import { useEffect, useRef, useState } from "react";
import { gradeLabel, subjectLabel, type StudyContext } from "@/lib/constants";
import type { ExamFocus, ExamFocusItem, Presentation } from "@/lib/types";
import { ExamFocusPanel, PriorityBadge, SECONDARY_GRADES } from "../ExamFocusPanel";
import { postJson } from "@/lib/client/stream";
import { useHistory, useStored, type HistoryItem } from "@/lib/client/storage";
import { downloadPptx, slideBullets, stripTicks, THEMES, themeById, type SlideTheme } from "@/lib/client/pptx";
import { buildHtmlDeck } from "@/lib/client/htmlDeck";
import { toPayload, type PickedImage } from "@/lib/client/image";
import { ImageInput } from "../ImageInput";
import { Dialog } from "../LibraryPicker";
import { CopyButton } from "../ResultActions";
import { HistoryPanel } from "../HistoryPanel";
import { MoreExplainer } from "../ResultView";
import { Button, Card, EmptyHint, ErrorBox, Field, Input, Loading, Segmented, Spinner, TextArea, Toggle, cx } from "../ui";

const TYPE_LABEL: Record<string, string> = {
  cards: "بطاقات",
  steps: "خطوات",
  compare: "مقارنة",
  balance: "ميزان تفاعلي",
  stats: "أرقام",
  quote: "فكرة محورية",
  quiz: "اختبار تفاعلي",
  timer: "مؤقت نشاط",
  problem: "مسألة محلولة",
  vectors: "رسم متجهات تفاعلي",
};

interface DeckState {
  topic: string;
  themeId: string;
  studentName: string;
  presentation: Presentation;
  extras: string[];
  /** حصر الدرس في الاختبارات (ثانوي) كما اعتمده المستخدم */
  focus?: FocusValue | null;
}
type FocusValue = { focus: ExamFocus; items: ExamFocusItem[] };

const hex = (c: string) => `#${c}`;

/** شريحة بنسبة 16:9 — الخطوط بوحدة cqw عشان تتناسب مع العرض */
function SlideFrame({ theme, children, dark }: { theme: SlideTheme; children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className="@container relative aspect-video w-full overflow-hidden rounded-xl shadow-md ring-1 ring-black/5"
      style={{ background: hex(dark ? theme.titleBg : theme.bg) }}
    >
      {children}
    </div>
  );
}

function TitleSlide({ p, theme, name, meta, byline }: { p: Presentation; theme: SlideTheme; name: string; meta: string; byline: string }) {
  return (
    <SlideFrame theme={theme} dark>
      <div className="absolute inset-x-0 bottom-0 h-[4.5%]" style={{ background: hex(theme.accent) }} />
      <div className="absolute top-[31%] right-[6%] h-[30%] w-[0.9%]" style={{ background: hex(theme.accent) }} />
      <div className="absolute inset-y-0 right-[10%] left-[6%] flex flex-col justify-center" style={{ color: hex(theme.titleText) }}>
        <div className="font-extrabold leading-tight" style={{ fontSize: "5.2cqw" }}>
          {p.title}
        </div>
        <div className="mt-[2%] opacity-90" style={{ fontSize: "2.8cqw" }}>
          {p.subtitle}
        </div>
        <div className="mt-[8%] opacity-90" style={{ fontSize: "1.8cqw" }}>
          {[name && `${byline}: ${name}`, meta].filter(Boolean).join("   •   ")}
        </div>
      </div>
    </SlideFrame>
  );
}

function ContentSlide({ s, n, theme }: { s: Presentation["slides"][number]; n: number; theme: SlideTheme }) {
  return (
    <SlideFrame theme={theme}>
      <PriorityBadge priority={s.priority} />
      <div className="absolute inset-y-0 right-0 w-[1.9%]" style={{ background: hex(theme.titleBg) }} />
      <div className="absolute inset-y-[6%] right-[6%] left-[5%]">
        <div
          className={cx("font-bold leading-tight", (s.priority === "high" || s.priority === "medium") && "pl-[17%]")}
          style={{ fontSize: "3.6cqw", color: hex(theme.heading) }}
        >
          {stripTicks(s.title)}
        </div>
        <div className="mt-[1.5%] h-[1%] w-[19%]" style={{ background: hex(theme.accent) }} />
        <ul className="mt-[3.5%] space-y-[1.2cqw]" style={{ fontSize: "2.3cqw", color: hex(theme.text) }}>
          {slideBullets(s).map(stripTicks).map((b, i) => (
            <li key={i} className="flex gap-[1.2cqw]">
              <span style={{ color: hex(theme.accent) }}>●</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute bottom-[4%] left-[3%]" style={{ fontSize: "1.4cqw", color: hex(theme.accent) }}>
        {n}
      </div>
      {s.type && TYPE_LABEL[s.type] && (
        <div className="absolute right-[6%] bottom-[4%] rounded-full px-[1cqw] py-[0.3cqw] font-bold" style={{ fontSize: "1.4cqw", background: hex(theme.accent), color: "#fff" }}>
          {TYPE_LABEL[s.type]}
        </div>
      )}
    </SlideFrame>
  );
}

export function PresentationTool({ ctx }: { ctx: StudyContext }) {
  const teacher = ctx.role === "teacher";
  const history = useHistory<DeckState>(teacher ? "teacher:presentation" : "presentation");
  const [topic, setTopic] = useState("");
  const [focus, setFocus] = useState<FocusValue | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [quizOn, setQuizOn] = useStored("presentation:quiz", true);
  const [timer, setTimer] = useStored("presentation:timer", 0);
  const [varied, setVaried] = useStored("presentation:varied", true);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlTab, setHtmlTab] = useState<"show" | "code">("show");
  const [format, setFormat] = useStored<"both" | "pptx" | "html">("presentation:format", "both");
  const secondary = SECONDARY_GRADES.includes(ctx.grade);
  const [count, setCount] = useState(6);
  const [themeId, setThemeId] = useStored("presentation:theme", THEMES[0].id);
  const [studentName, setStudentName] = useStored(teacher ? "teacher:presentation:name" : "presentation:name", "");
  // أكثر من اسم (فاصلة أو «و» بين الأسماء) ← صيغة الجمع
  const many = /[،,]|\sو\s/.test(studentName.trim()) || studentName.trim().split(/\s+/).length >= 5;
  const byline = teacher ? (many ? "إعداد المعلمين" : "إعداد المعلم/ة") : many ? "إعداد الطلاب" : "إعداد الطالب";
  const [state, setState] = useState<{ id: string; data: DeckState } | null>(null);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const meta = `${subjectLabel(ctx.subject)} — ${gradeLabel(ctx.grade)}`;

  async function generate() {
    if (!topic.trim() || loading) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    try {
      const useFocus = secondary && focus?.items.length ? focus : null;
      const presentation = await postJson<Presentation>(
        "/api/json",
        {
          ...ctx,
          tool: "presentation",
          topic,
          count,
          focus: useFocus?.items,
          content,
          images: toPayload(files),
          quiz: quizOn,
          timer,
          varied,
        },
        ac.signal,
      );
      if (!presentation.slides?.length) throw new Error("ما طلعت شرائح. جرّب موضوع ثاني.");
      const data: DeckState = { topic, themeId, studentName, presentation, extras: [], focus: useFocus };
      const id = history.add({ label: presentation.title || topic, grade: ctx.grade, subject: ctx.subject, data });
      setState({ id, data });
      setCurrent(0);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function update(data: DeckState) {
    if (!state) return;
    setState({ ...state, data });
    history.update(state.id, data);
  }

  // الثيم والاسم ينطبقون على العرض الحالي مباشرة
  const theme = themeById(themeId);
  const p = state?.data.presentation;
  const total = p ? p.slides.length + 1 : 0;

  async function download() {
    if (!p) return;
    setDownloading(true);
    setError("");
    try {
      await downloadPptx(p, { themeId, studentName: studentName.trim(), meta, bylineLabel: byline });
    } catch {
      setError("ما قدرنا نجهز ملف البوربوينت. حاول مرة ثانية.");
    } finally {
      setDownloading(false);
    }
  }

  const asText = p
    ? `# ${p.title}\n${p.subtitle}\n\n${p.slides
        .map((s, i) => `## ${i + 1}. ${s.title}\n${slideBullets(s).map((b) => `- ${stripTicks(b)}`).join("\n")}\n\n> ملاحظات: ${s.notes}`)
        .join("\n\n")}`
    : "";

  // العرض التفاعلي (ملف HTML واحد)
  const html = p ? buildHtmlDeck(p, { theme, byline: studentName.trim() ? `${byline}: ${studentName.trim()}` : "", meta, name: studentName.trim() }) : "";
  const safeName = (p?.title ?? "عرض").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 60) || "عرض";
  function downloadHtml() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = `${safeName}.html`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  }
  function openHtmlTab() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <div>
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="موضوع العرض" className="sm:col-span-2">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: الطاقة المتجددة في الكويت" maxLength={300} />
            </Field>
            <Field label="اسمك أو أسماء الفريق (تطلع في شريحة العنوان)">
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder={teacher ? "اسم المعلم/ة" : "اسمك، أو أسماء الفريق: فلان، فلان و فلان"}
                maxLength={150}
              />
            </Field>
            <Field label={`عدد الشرائح: ${count.toLocaleString("ar")} (غير شريحة العنوان)`}>
              <input type="range" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-3 w-full accent-brand-600" />
            </Field>
          </div>
          <div>
            <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">الثيم</span>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  aria-pressed={themeId === t.id}
                  className={cx(
                    "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors",
                    themeId === t.id ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30" : "border-slate-200 dark:border-slate-700",
                  )}
                >
                  <span className="flex overflow-hidden rounded-md ring-1 ring-black/10">
                    <span className="size-4" style={{ background: hex(t.titleBg) }} />
                    <span className="size-4" style={{ background: hex(t.bg) }} />
                    <span className="size-4" style={{ background: hex(t.accent) }} />
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">صيغة العرض</span>
            <Segmented
              label="صيغة العرض"
              value={format}
              onChange={setFormat}
              options={[
                { value: "pptx", label: "📊 باوربوينت" },
                { value: "html", label: "💻 كود (HTML تفاعلي)" },
                { value: "both", label: "الاثنين" },
              ]}
            />
          </div>
          <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <summary className="cursor-pointer font-bold">📄 المحتوى (اختياري): الصق الدرس أو أضف صفحات الكتاب</summary>
            <div className="mt-3 space-y-2">
              <TextArea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="الصق المحتوى أو النقاط هنا…" maxLength={15000} aria-label="محتوى العرض" />
              <ImageInput images={files} onChange={setFiles} allowPdf />
              <p className="text-xs text-slate-500">إذا أضفت محتوى، المساعد يلتزم فيه بس، وما يضيف معلومات أو أرقام من عنده.</p>
            </div>
          </details>
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="font-bold">✨ الشرائح التفاعلية (في العرض التفاعلي)</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <Toggle checked={quizOn} onChange={setQuizOn} label="اختبار سريع" hint="٣ أسئلة: الصح بالأخضر والخطأ بالأحمر" />
              <Toggle checked={varied} onChange={setVaried} label="شرائح متنوعة" hint="بطاقات، خطوات، مقارنة، ميزان، أرقام…" />
              <div>
                <span className="mb-1 block text-sm font-bold">مؤقت نشاط</span>
                <Segmented
                  label="مؤقت نشاط"
                  value={timer}
                  onChange={setTimer}
                  options={[
                    { value: 0, label: "بدون" },
                    { value: 5, label: "٥ د" },
                    { value: 10, label: "١٠ د" },
                    { value: 15, label: "١٥ د" },
                  ]}
                />
              </div>
            </div>
          </div>
          {secondary && <ExamFocusPanel ctx={ctx} topic={topic} value={focus} onChange={setFocus} />}
          <Button type="submit" disabled={!topic.trim() || loading} className="w-full sm:w-auto">
            🎞️ {secondary && focus?.items.length ? "جهّز العرض حسب أولويات الاختبار" : "جهّز العرض"}
          </Button>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {loading && <Loading text="جاري تجهيز الشرائح…" />}
        {error && <ErrorBox message={error} onRetry={state ? download : generate} />}
        {!p && !loading && !error && (
          <EmptyHint icon="🎞️" title="برزنتيشن جاهز بدقايق" text="حدد الموضوع وعدد الشرائح والثيم واسمك. يطلع لك عرض تفاعلي (ملف HTML فيه حركات واختبار ومؤقت)، وملف PowerPoint فيه ملاحظات المتحدث." />
        )}

        {p && (
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">معاينة الشرائح</span>
              <div className="flex flex-wrap gap-2">
                {format !== "pptx" && (
                  <>
                    <Button onClick={() => { setHtmlTab("show"); setHtmlOpen(true); }}>▶ العرض التفاعلي</Button>
                    <Button variant="secondary" onClick={() => { setHtmlTab("code"); setHtmlOpen(true); }}>
                      💻 الكود
                    </Button>
                    <Button variant="secondary" onClick={downloadHtml}>
                      ⬇️ ملف ‎.html
                    </Button>
                  </>
                )}
                {format !== "html" && (
                  <Button variant={format === "pptx" ? "primary" : "secondary"} onClick={download} disabled={downloading}>
                    {downloading ? <Spinner /> : "⬇️"} ملف ‎.pptx
                  </Button>
                )}
                {format !== "both" && (
                  <Button variant="ghost" size="sm" onClick={() => setFormat("both")}>
                    + {format === "pptx" ? "كود HTML" : "باوربوينت"}
                  </Button>
                )}
              </div>
            </div>

            <div className="mx-auto max-w-3xl">
              {current === 0 ? (
                <TitleSlide p={p} theme={theme} name={studentName.trim()} meta={meta} byline={byline} />
              ) : (
                <ContentSlide s={p.slides[current - 1]} n={current + 1} theme={theme} />
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
                  → السابقة
                </Button>
                <span className="text-sm text-slate-500">
                  {(current + 1).toLocaleString("ar")} / {total.toLocaleString("ar")}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))} disabled={current === total - 1}>
                  التالية ←
                </Button>
              </div>
              {htmlOpen && (
                <Dialog title={`▶ ${p.title}`} onClose={() => setHtmlOpen(false)} wide>
                  <div className="space-y-3">
                    <Segmented
                      label="العرض أو الكود"
                      value={htmlTab}
                      onChange={setHtmlTab}
                      options={[
                        { value: "show", label: "▶ العرض" },
                        { value: "code", label: "💻 الكود" },
                      ]}
                    />
                    {htmlTab === "code" ? (
                      <div className="space-y-2">
                        <textarea
                          readOnly
                          value={html}
                          dir="ltr"
                          aria-label="كود العرض"
                          className="h-[55dvh] w-full resize-none rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-700"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                          <span>
                            ملف HTML واحد ({Math.round(html.length / 1024)} KB). تقدر تعطيه لأي ذكاء اصطناعي وتطلب تعديلات، أو تحفظه باسم ‎عرض.html‎ (UTF-8) وتفتحه بالمتصفح.
                          </span>
                          <div className="flex gap-2">
                            <CopyButton text={html} />
                            <Button size="sm" onClick={downloadHtml}>
                              ⬇️ تحميل
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                    <>
                    <iframe
                      title="العرض التفاعلي"
                      srcDoc={html}
                      sandbox="allow-scripts"
                      allow="fullscreen"
                      allowFullScreen
                      className="aspect-video w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                      <span>اضغط داخل العرض: ← أو مسافة للتالي · N ملاحظات · O كل الشرائح · F ملء الشاشة</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={openHtmlTab}>
                          افتح في تبويب جديد ↗
                        </Button>
                        <Button size="sm" onClick={downloadHtml}>
                          ⬇️ تحميل
                        </Button>
                      </div>
                    </div>
                    </>
                    )}
                  </div>
                </Dialog>
              )}
              {current > 0 && p.slides[current - 1].notes && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                  <span className="font-bold">🎤 {teacher ? "ملاحظات للمعلم" : "ملاحظات المتحدث"}: </span>
                  {p.slides[current - 1].notes}
                </div>
              )}
            </div>

            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: total }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={cx("w-28 shrink-0 rounded-lg p-0.5 ring-2 transition", i === current ? "ring-brand-500" : "ring-transparent opacity-70 hover:opacity-100")}
                  aria-label={`الشريحة ${i + 1}`}
                >
                  {i === 0 ? <TitleSlide p={p} theme={theme} name={studentName.trim()} meta={meta} byline={byline} /> : <ContentSlide s={p.slides[i - 1]} n={i + 1} theme={theme} />}
                </button>
              ))}
            </div>

            <MoreExplainer
              ctx={ctx}
              source={asText}
              request={
                teacher
                  ? `عرض تقديمي لشرح درس: ${state!.data.topic}. عطني أسئلة نقاش وأنشطة مرافقة لكل شريحة.`
                  : `عرض تقديمي عن: ${state!.data.topic}. اشرح لي محتوى العرض بتفصيل أكثر عشان أقدر أقدمه بثقة.`
              }
              extras={state!.data.extras}
              onExtrasChange={(extras) => update({ ...state!.data, extras })}
            />
          </Card>
        )}
      </div>

      <HistoryPanel
        items={history.items}
        activeId={state?.id}
        onOpen={(it: HistoryItem<DeckState>) => {
          setState({ id: it.id, data: it.data });
          setThemeId(it.data.themeId);
          if (it.data.studentName) setStudentName(it.data.studentName);
          setCurrent(0);
          setError("");
          setTopic(it.data.topic);
          setFocus(it.data.focus ?? null);
        }}
        onRemove={history.remove}
        onClear={history.clear}
      />
    </div>
  );
}
