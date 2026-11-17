"use client";
import { useEffect, useRef, useState } from "react";
import { gradeLabel, subjectLabel, type StudyContext } from "@/lib/constants";
import type { Presentation } from "@/lib/types";
import { postJson } from "@/lib/client/stream";
import { useHistory, useStored, type HistoryItem } from "@/lib/client/storage";
import { downloadPptx, THEMES, themeById, type SlideTheme } from "@/lib/client/pptx";
import { HistoryPanel } from "../HistoryPanel";
import { MoreExplainer } from "../ResultView";
import { Button, Card, EmptyHint, ErrorBox, Field, Input, Loading, Spinner, cx } from "../ui";

interface DeckState {
  topic: string;
  themeId: string;
  studentName: string;
  presentation: Presentation;
  extras: string[];
}

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

function TitleSlide({ p, theme, name, meta }: { p: Presentation; theme: SlideTheme; name: string; meta: string }) {
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
          {[name && `إعداد الطالب: ${name}`, meta].filter(Boolean).join("   •   ")}
        </div>
      </div>
    </SlideFrame>
  );
}

function ContentSlide({ s, n, theme }: { s: Presentation["slides"][number]; n: number; theme: SlideTheme }) {
  return (
    <SlideFrame theme={theme}>
      <div className="absolute inset-y-0 right-0 w-[1.9%]" style={{ background: hex(theme.titleBg) }} />
      <div className="absolute inset-y-[6%] right-[6%] left-[5%]">
        <div className="font-bold leading-tight" style={{ fontSize: "3.6cqw", color: hex(theme.heading) }}>
          {s.title}
        </div>
        <div className="mt-[1.5%] h-[1%] w-[19%]" style={{ background: hex(theme.accent) }} />
        <ul className="mt-[3.5%] space-y-[1.2cqw]" style={{ fontSize: "2.3cqw", color: hex(theme.text) }}>
          {s.bullets.map((b, i) => (
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
    </SlideFrame>
  );
}

export function PresentationTool({ ctx }: { ctx: StudyContext }) {
  const history = useHistory<DeckState>("presentation");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [themeId, setThemeId] = useStored("presentation:theme", THEMES[0].id);
  const [studentName, setStudentName] = useStored("presentation:name", "");
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
      const presentation = await postJson<Presentation>("/api/json", { ...ctx, tool: "presentation", topic, count }, ac.signal);
      if (!presentation.slides?.length) throw new Error("ما طلعت شرائح. جرّب موضوع ثاني.");
      const data: DeckState = { topic, themeId, studentName, presentation, extras: [] };
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
      await downloadPptx(p, { themeId, studentName: studentName.trim(), meta });
    } catch {
      setError("ما قدرنا نجهز ملف البوربوينت. حاول مرة ثانية.");
    } finally {
      setDownloading(false);
    }
  }

  const asText = p
    ? `# ${p.title}\n${p.subtitle}\n\n${p.slides
        .map((s, i) => `## ${i + 1}. ${s.title}\n${s.bullets.map((b) => `- ${b}`).join("\n")}\n\n> ملاحظات: ${s.notes}`)
        .join("\n\n")}`
    : "";

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
            <Field label="اسمك (يطلع في شريحة العنوان)">
              <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="اسم الطالب" maxLength={60} />
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
          <Button type="submit" disabled={!topic.trim() || loading} className="w-full sm:w-auto">
            🎞️ جهّز العرض
          </Button>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {loading && <Loading text="جاري تجهيز الشرائح…" />}
        {error && <ErrorBox message={error} onRetry={state ? download : generate} />}
        {!p && !loading && !error && (
          <EmptyHint icon="🎞️" title="برزنتيشن جاهز بدقايق" text="حدد الموضوع وعدد الشرائح والثيم واسمك، وبعدها تقدر تحمّل ملف PowerPoint فيه ملاحظات المتحدث." />
        )}

        {p && (
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">معاينة الشرائح</span>
              <Button onClick={download} disabled={downloading}>
                {downloading ? <Spinner /> : "⬇️"} تحميل ملف ‎.pptx
              </Button>
            </div>

            <div className="mx-auto max-w-3xl">
              {current === 0 ? (
                <TitleSlide p={p} theme={theme} name={studentName.trim()} meta={meta} />
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
              {current > 0 && p.slides[current - 1].notes && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                  <span className="font-bold">🎤 ملاحظات المتحدث: </span>
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
                  {i === 0 ? <TitleSlide p={p} theme={theme} name={studentName.trim()} meta={meta} /> : <ContentSlide s={p.slides[i - 1]} n={i + 1} theme={theme} />}
                </button>
              ))}
            </div>

            <MoreExplainer
              ctx={ctx}
              source={asText}
              request={`عرض تقديمي عن: ${state!.data.topic}. اشرح لي محتوى العرض بتفصيل أكثر عشان أقدر أقدمه بثقة.`}
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
        }}
        onRemove={history.remove}
        onClear={history.clear}
      />
    </div>
  );
}
