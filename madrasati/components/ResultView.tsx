"use client";
import { useEffect, useRef, useState } from "react";
import type { StudyContext } from "@/lib/constants";
import { streamPost } from "@/lib/client/stream";
import { Markdown } from "./Markdown";
import { ResultActions } from "./ResultActions";
import { Card, ErrorBox, Spinner } from "./ui";

/**
 * يعرض أزرار «نسخ» و«اشرح أكثر» تحت أي نتيجة، ومعها الشروحات الإضافية.
 * source: نص النتيجة (للنسخ ولإرساله مع طلب الشرح الإضافي)
 */
export function MoreExplainer({
  ctx,
  source,
  request,
  extras,
  onExtrasChange,
  actionsExtra,
}: {
  ctx: StudyContext;
  source: string;
  request?: string;
  extras: string[];
  onExtrasChange: (extras: string[]) => void;
  actionsExtra?: React.ReactNode;
}) {
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function more() {
    setBusy(true);
    setError("");
    setLive("");
    const ac = new AbortController();
    abortRef.current = ac;
    setTimeout(() => liveRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    try {
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

  return (
    <>
      <ResultActions
        text={source}
        onMore={extras.length === 0 ? more : undefined}
        moreBusy={busy}
        extra={actionsExtra}
      />
      {extras.map((t, i) => (
        <Card key={i} className="mt-4 border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/10">
          <div className="mb-2 text-sm font-bold text-amber-700 dark:text-amber-300">💡 شرح إضافي</div>
          <Markdown>{t}</Markdown>
          <ResultActions text={t} onMore={i === extras.length - 1 ? more : undefined} moreBusy={busy} />
        </Card>
      ))}
      {(busy || error) && (
        <div ref={liveRef} className="mt-4">
          {busy && (
            <Card className="border-amber-200 dark:border-amber-900/60">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300">
                <Spinner /> 💡 شرح إضافي
              </div>
              {live ? <Markdown>{live}</Markdown> : <p className="text-slate-500">جاري التفكير…</p>}
            </Card>
          )}
          {error && <ErrorBox message={error} onRetry={more} />}
        </div>
      )}
    </>
  );
}

export function ResultView({
  ctx,
  content,
  streaming,
  request,
  extras,
  onExtrasChange,
}: {
  ctx: StudyContext;
  content: string;
  streaming: boolean;
  request?: string;
  extras: string[];
  onExtrasChange: (extras: string[]) => void;
}) {
  return (
    <div>
      <Card>
        {content ? (
          <Markdown>{content}</Markdown>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <Spinner className="text-brand-500" /> جاري التفكير…
          </div>
        )}
        {streaming && content && (
          <span className="mt-2 inline-block h-4 w-2 animate-pulse rounded-sm bg-brand-500 align-middle" aria-hidden />
        )}
        {!streaming && content && (
          <MoreExplainer
            ctx={ctx}
            source={content}
            request={request}
            extras={extras}
            onExtrasChange={onExtrasChange}
          />
        )}
      </Card>
    </div>
  );
}
