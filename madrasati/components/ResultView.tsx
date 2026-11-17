"use client";
import { useEffect, useRef, useState } from "react";
import type { StudyContext } from "@/lib/constants";
import { streamPost } from "@/lib/client/stream";
import { applyAliases, type Aliases } from "@/lib/client/privacy";
import { Markdown } from "./Markdown";
import { ResultActions } from "./ResultActions";
import { Button, Card, ErrorBox, Spinner, TextArea } from "./ui";

/**
 * يعرض أزرار «نسخ» و«اشرح أكثر» تحت أي نتيجة، ومعها الشروحات الإضافية.
 * source: نص النتيجة كما وصل من المساعد (بالرموز، بدون الأسماء الحقيقية)
 * aliases: لتعويض الرموز بالأسماء في العرض والنسخ فقط
 */
export function MoreExplainer({
  ctx,
  source,
  request,
  extras,
  onExtrasChange,
  actionsExtra,
  printable,
  aliases,
}: {
  ctx: StudyContext;
  source: string;
  request?: string;
  extras: string[];
  onExtrasChange: (extras: string[]) => void;
  actionsExtra?: React.ReactNode;
  printable?: boolean;
  aliases?: Aliases;
}) {
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const moreLabel = ctx.role === "teacher" ? "فصّل أكثر" : "اشرح أكثر";
  const show = (t: string) => applyAliases(t, aliases);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function more() {
    setBusy(true);
    setError("");
    setLive("");
    const ac = new AbortController();
    abortRef.current = ac;
    setTimeout(() => liveRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    try {
      // نرسل النص بالرموز، مو بالأسماء الحقيقية
      const previous = [source, ...extras].join("\n\n---\n\n").slice(-30000);
      const text = await streamPost("/api/generate", { ...ctx, tool: "more", previous, request }, setLive, ac.signal);
      onExtrasChange([...extras, text]);
      setLive("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const extraTitle = ctx.role === "teacher" ? "تفصيل إضافي" : "شرح إضافي";

  return (
    <>
      <ResultActions
        text={show(source)}
        onMore={extras.length === 0 ? more : undefined}
        moreBusy={busy}
        extra={actionsExtra}
        printable={printable}
        moreLabel={moreLabel}
      />
      {extras.map((t, i) => (
        <div key={i} data-print>
          <Card className="mt-4 border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/10">
            <div className="mb-2 text-sm font-bold text-amber-700 dark:text-amber-300">💡 {extraTitle}</div>
            <Markdown>{show(t)}</Markdown>
            <ResultActions
              text={show(t)}
              onMore={i === extras.length - 1 ? more : undefined}
              moreBusy={busy}
              printable={printable}
              moreLabel={moreLabel}
            />
          </Card>
        </div>
      ))}
      {(busy || error) && (
        <div ref={liveRef} className="no-print mt-4">
          {busy && (
            <Card className="border-amber-200 dark:border-amber-900/60">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300">
                <Spinner /> 💡 {extraTitle}
              </div>
              {live ? <Markdown>{show(live)}</Markdown> : <p className="text-slate-500">جاري التفكير…</p>}
            </Card>
          )}
          {error && <ErrorBox message={error} onRetry={more} />}
        </div>
      )}
    </>
  );
}

export interface ReviewState {
  approved?: boolean;
  edited?: boolean;
}

/** شريط المراجعة في وضع المعلم: المساعد يقترح ← المعلم يراجع ويعدّل ويعتمد */
function ReviewBar({
  review,
  onEdit,
  onApprove,
  editing,
}: {
  review: ReviewState;
  onEdit: () => void;
  onApprove: (v: boolean) => void;
  editing: boolean;
}) {
  if (review.approved)
    return (
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <span className="flex-1 font-bold">✅ راجعتها واعتمدتها{review.edited ? " (بعد التعديل)" : ""}</span>
        <Button variant="ghost" size="sm" onClick={() => onApprove(false)}>
          إلغاء الاعتماد
        </Button>
      </div>
    );
  return (
    <div
      className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      role="note"
    >
      <span className="flex-1">
        🤖 <b>مسودة مقترحة{review.edited ? " (عدّلتها)" : ""}</b>: راجعها وعدّل اللي تحتاجه. القرار الأخير لك.
      </span>
      {!editing && (
        <>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            ✏️ تعديل
          </Button>
          <Button size="sm" onClick={() => onApprove(true)}>
            ✅ اعتمد
          </Button>
        </>
      )}
    </div>
  );
}

export function ResultView({
  ctx,
  content,
  streaming,
  request,
  extras,
  onExtrasChange,
  aliases,
  review,
  onReviewChange,
}: {
  ctx: StudyContext;
  content: string;
  streaming: boolean;
  request?: string;
  extras: string[];
  onExtrasChange: (extras: string[]) => void;
  aliases?: Aliases;
  review?: ReviewState;
  /** لما يعدّل المعلم النص أو يعتمده */
  onReviewChange?: (patch: { content?: string } & ReviewState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const teacher = ctx.role === "teacher" && !!onReviewChange;

  return (
    <div data-print>
      <Card>
        {teacher && !streaming && content && (
          <ReviewBar
            review={review ?? {}}
            editing={editing}
            onEdit={() => {
              setDraft(content);
              setEditing(true);
            }}
            onApprove={(approved) => onReviewChange!({ approved })}
          />
        )}
        {editing ? (
          <div className="no-print space-y-2">
            <TextArea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(30, Math.max(10, draft.split("\n").length + 2))}
              className="font-mono text-sm"
              dir="auto"
              aria-label="تعديل النتيجة"
            />
            <p className="text-xs text-slate-500">
              تقدر تعدّل بصيغة Markdown. الرموز مثل S1 و [اسم الطالب] تتبدل بالأسماء تلقائياً في العرض.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onReviewChange!({ content: draft, edited: draft !== content || review?.edited, approved: false });
                  setEditing(false);
                }}
              >
                💾 حفظ التعديل
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : content ? (
          <Markdown>{applyAliases(content, aliases)}</Markdown>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <Spinner className="text-brand-500" /> جاري التفكير…
          </div>
        )}
        {streaming && content && (
          <span className="mt-2 inline-block h-4 w-2 animate-pulse rounded-sm bg-brand-500 align-middle" aria-hidden />
        )}
        {!streaming && content && !editing && (
          <MoreExplainer
            ctx={ctx}
            source={content}
            request={request}
            extras={extras}
            onExtrasChange={onExtrasChange}
            aliases={aliases}
            printable
          />
        )}
      </Card>
    </div>
  );
}
