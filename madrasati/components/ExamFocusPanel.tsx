"use client";
import { useEffect, useMemo, useState } from "react";
import type { StudyContext } from "@/lib/constants";
import type { ExamFocus, ExamFocusItem, Priority } from "@/lib/types";
import { normalizeAr } from "@/lib/subjectMatch";
import { currentTerm } from "@/lib/client/appContext";
import { toPayload, type PickedImage } from "@/lib/client/image";
import { moeCatalog, moePageCount, skwSubjects, type MoeItem } from "@/lib/client/library";
import { postJson } from "@/lib/client/stream";
import { ImageInput } from "./ImageInput";
import { CopyButton } from "./ResultActions";
import { Button, ErrorBox, Input, Loading, Segmented, cx } from "./ui";

export const SECONDARY_GRADES = ["10", "11", "12"];

export const PRIORITY_META: Record<Priority, { label: string; badge: string; icon: string }> = {
  high: { label: "عالية", icon: "🔴", badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  medium: { label: "متوسطة", icon: "🟠", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  low: { label: "منخفضة", icon: "🟢", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

const STOP = new Set(["درس", "الدرس", "الوحده", "وحده", "الفصل", "الاول", "الثاني", "في", "من", "علي", "عن", "مع", "و"]);
const words = (s: string) =>
  normalizeAr(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w));

/** درجة تقارب عنوان الملف مع اسم الدرس */
function score(title: string, topic: string) {
  const t = normalizeAr(title);
  return words(topic).filter((w) => t.includes(w) || t.includes(w.replace(/^ال/, ""))).length;
}

interface Picked {
  item: MoeItem;
  total: number | null;
  from: string;
  to: string;
}

/** نص الحصر (للنسخ والطباعة) */
export function focusToMarkdown(f: ExamFocus, items: ExamFocusItem[]) {
  return [
    `# 🎯 حصر «${f.lesson}» في الاختبارات`,
    f.coverage,
    "",
    "| الأولوية | البند | مرات الظهور | أنواع الأسئلة | ملاحظة |",
    "|---|---|---|---|---|",
    ...items.map((i) => `| ${PRIORITY_META[i.priority].icon} ${PRIORITY_META[i.priority].label} | ${i.topic} | ${i.count} | ${i.question_types.join("، ")} | ${i.tip} |`),
    "",
    f.sample_questions.length ? "## أسئلة على نمط الاختبار" : "",
    ...f.sample_questions.map((q, n) => `${n + 1}. ${q}`),
  ].join("\n");
}

/**
 * 🎯 أولويات الاختبار (ثانوي): يحلل ملفات المراجعات والاختبارات ويحصر كل ما يخص الدرس مرتّباً حسب الأهمية.
 * المستخدم يعدّل الأولويات ويقرر قبل ما تنبني السلايدات.
 */
export function ExamFocusPanel({
  ctx,
  topic,
  value,
  onChange,
}: {
  ctx: StudyContext;
  topic: string;
  value: { focus: ExamFocus; items: ExamFocusItem[] } | null;
  onChange: (v: { focus: ExamFocus; items: ExamFocusItem[] } | null) => void;
}) {
  const [term, setTerm] = useState<1 | 2>(currentTerm());
  const [files, setFiles] = useState<MoeItem[] | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [uploads, setUploads] = useState<PickedImage[]>([]);
  const [skwLink, setSkwLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ملفات المراجعات وأوراق العمل للمادة والفصل
  useEffect(() => {
    let alive = true;
    setFiles(null);
    setPicked([]);
    moeCatalog(ctx.grade, term, false, ctx.subject)
      .then((c) => {
        if (!alive) return;
        const ids = new Set(c.subjects.filter((s) => s.match).map((s) => s.id));
        setFiles(c.exams.filter((e) => ids.has(e.subjectId)));
      })
      .catch((e) => alive && setError((e as Error).message));
    skwSubjects(ctx.grade, term, ctx.subject)
      .then((s) => {
        const sec = s.subjects.find((x) => x.match);
        if (alive) setSkwLink(sec ? `https://school-kw.com/section/${sec.id}/` : s.source);
      })
      .catch(() => alive && setSkwLink(null));
    return () => {
      alive = false;
    };
  }, [ctx.grade, ctx.subject, term]);

  // ترتيب الملفات حسب قربها من اسم الدرس
  const ranked = useMemo(() => (files ?? []).map((f) => ({ f, s: score(f.title, topic) })).sort((a, b) => b.s - a.s), [files, topic]);

  function toggle(item: MoeItem) {
    if (picked.some((p) => p.item.id === item.id)) return setPicked((ps) => ps.filter((p) => p.item.id !== item.id));
    if (picked.length >= 4) return setError("تقدر تختار ٤ ملفات كحد أقصى.");
    setError("");
    setPicked((ps) => [...ps, { item, total: null, from: "1", to: "20" }]);
    moePageCount("exam", item.id)
      .then((r) => setPicked((ps) => ps.map((p) => (p.item.id === item.id ? { ...p, total: r.total, to: String(Math.min(r.total, r.maxPages)) } : p))))
      .catch((e) => setError((e as Error).message));
  }

  async function analyze() {
    if (!topic.trim()) return setError("اكتب موضوع العرض (اسم الدرس) فوق أول.");
    setBusy(true);
    setError("");
    try {
      const focus = await postJson<ExamFocus>("/api/json", {
        ...ctx,
        tool: "examFocus",
        topic,
        moeFiles: picked.map((p) => ({ id: p.item.id, title: p.item.title, from: Number(p.from), to: Number(p.to) })),
        images: toPayload(uploads),
      });
      onChange({ focus, items: focus.items });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setItem = (i: number, patch: Partial<ExamFocusItem>) => value && onChange({ ...value, items: value.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  if (value) {
    const { focus, items } = value;
    return (
      <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/40 p-4 dark:border-red-900/60 dark:bg-red-950/10" data-print>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold">🎯 حصر «{focus.lesson}» في الاختبارات</div>
          <div className="no-print flex gap-1">
            <CopyButton text={focusToMarkdown(focus, items)} />
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              🔁 حلّل من جديد
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{focus.coverage}</p>
        {focus.warnings && <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">⚠️ {focus.warnings}</p>}
        <p className="no-print text-xs text-slate-500">🤖 هذا حصر مقترح: غيّر الأولوية أو احذف أي بند، والسلايدات بتنبني على اختيارك.</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-start">الأولوية</th>
                <th className="px-3 py-2 text-start">البند</th>
                <th className="px-3 py-2 text-center">ظهر</th>
                <th className="px-3 py-2 text-start">أنواع الأسئلة</th>
                <th className="px-3 py-2 text-start">ملاحظة للطالب</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="px-2 py-2">
                    <select
                      value={it.priority}
                      onChange={(e) => setItem(i, { priority: e.target.value as Priority })}
                      aria-label={`أولوية ${it.topic}`}
                      className={cx("rounded-full px-2 py-1 text-xs font-bold", PRIORITY_META[it.priority].badge)}
                    >
                      {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_META[p].icon} {PRIORITY_META[p].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 font-medium">{it.topic}</td>
                  <td className="px-3 py-2 text-center">{it.count}×</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{it.question_types.join("، ")}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{it.tip}</td>
                  <td className="no-print px-2 py-2">
                    <button
                      type="button"
                      aria-label={`احذف ${it.topic}`}
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => onChange({ ...value, items: items.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {focus.sample_questions.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-bold">📝 أسئلة على نمط الاختبار ({focus.sample_questions.length})</summary>
            <ol className="mt-2 list-decimal space-y-1 ps-6">
              {focus.sample_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold">🎯 رتّب العرض حسب الاختبارات (ثانوي)</div>
          <div className="text-xs text-slate-500">نحصر كل اللي يخص الدرس في المراجعات والاختبارات، ونرتبه حسب الأهمية قبل ما نبني السلايدات.</div>
        </div>
        <Segmented label="الفصل الدراسي" value={term} onChange={setTerm} options={[{ value: 1, label: "الفصل الأول" }, { value: 2, label: "الفصل الثاني" }]} />
      </div>

      <div>
        <div className="mb-1 text-sm font-bold">مراجعات وأوراق عمل الوزارة {files && `(${files.length})`}</div>
        {!files && !error && <Loading text="جاري جلب ملفات المراجعات…" />}
        {files && files.length === 0 && <p className="text-sm text-slate-500">ما فيه ملفات مراجعات لهذي المادة والفصل في مكتبة الوزارة.</p>}
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {ranked.map(({ f, s }) => {
            const p = picked.find((x) => x.item.id === f.id);
            return (
              <li key={f.id} className={cx("rounded-xl border px-3 py-2", p ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20" : "border-slate-200 dark:border-slate-700")}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-brand-600" checked={!!p} onChange={() => toggle(f)} />
                  <span className="flex-1">
                    {f.title} <span className="text-xs text-slate-500">· {f.label}</span>
                  </span>
                  {s > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">قريب من الدرس</span>}
                </label>
                {p && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {p.total == null ? (
                      <span className="text-slate-500">جاري حساب الصفحات…</span>
                    ) : (
                      <>
                        <span>الصفحات</span>
                        <Input
                          type="number"
                          min={1}
                          max={p.total}
                          value={p.from}
                          onChange={(e) => setPicked((ps) => ps.map((x) => (x.item.id === f.id ? { ...x, from: e.target.value } : x)))}
                          className="w-20 py-1"
                          aria-label={`من صفحة ${f.title}`}
                        />
                        <span>إلى</span>
                        <Input
                          type="number"
                          min={1}
                          max={p.total}
                          value={p.to}
                          onChange={(e) => setPicked((ps) => ps.map((x) => (x.item.id === f.id ? { ...x, to: e.target.value } : x)))}
                          className="w-20 py-1"
                          aria-label={`إلى صفحة ${f.title}`}
                        />
                        <span className="text-slate-500">من {p.total} (لين ٢٠ صفحة لكل ملف)</span>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-sm font-bold">اختبارات سابقة من عندك (اختياري)</div>
        <ImageInput images={uploads} onChange={setUploads} allowPdf noLibrary label="ارفع اختبارات (صور أو PDF)" />
        {skwLink && (
          <p className="mt-1 text-xs text-slate-500">
            تبي اختبارات سابقة؟ نزّلها من{" "}
            <a href={skwLink} target="_blank" rel="noreferrer noopener" className="text-brand-600 underline dark:text-brand-300">
              صفحة المادة في موقع مدرستي ↗
            </a>{" "}
            وارفعها هنا.
          </p>
        )}
      </div>

      {error && <ErrorBox message={error} />}
      {busy ? (
        <Loading text="المساعد يقرأ الأسئلة ويحصر الدرس… (ممكن ياخذ دقيقة أو دقيقتين)" />
      ) : (
        <Button variant="secondary" onClick={analyze} disabled={!picked.length && !uploads.length} className="w-full">
          🔍 حلّل الاختبارات وحصّر الدرس
        </Button>
      )}
    </div>
  );
}

/** شارة الأولوية على الشريحة */
export function PriorityBadge({ priority }: { priority?: string }) {
  if (priority !== "high" && priority !== "medium") return null;
  return (
    <span
      className={cx("absolute top-[4%] left-[3%] rounded-full px-[1.2cqw] py-[0.4cqw] font-bold", PRIORITY_META[priority].badge)}
      style={{ fontSize: "1.5cqw" }}
    >
      {priority === "high" ? "⭐ مهم للاختبار" : "◆ يجي أحياناً"}
    </span>
  );
}
