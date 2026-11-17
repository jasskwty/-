"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StudyContext } from "@/lib/constants";
import { streamPost } from "@/lib/client/stream";
import { useHistory, type HistoryItem } from "@/lib/client/storage";
import { HistoryPanel } from "./HistoryPanel";
import { ResultView } from "./ResultView";
import { Button, ErrorBox, Spinner } from "./ui";
import type { Aliases } from "@/lib/client/privacy";

export interface TextResult {
  request: string;
  content: string;
  extras: string[];
  /** رموز الطلاب ← أسمائهم (تنحفظ في الجهاز فقط) */
  aliases?: Aliases;
  approved?: boolean;
  edited?: boolean;
}

export interface RunArgs {
  /** جسم الطلب لـ /api/generate بدون الصف والمادة */
  body: Record<string, unknown>;
  /** عنوان قصير يظهر في السجل */
  label: string;
  /** وصف الطلب، يرسل مع «اشرح أكثر» */
  request: string;
  aliases?: Aliases;
}

/**
 * هيكل مشترك لأدوات النص (شرح، حل، تلخيص، تصحيح، جدول):
 * نموذج، نتيجة تظهر أول بأول، وسجل محفوظ.
 */
export function TextTool({
  tool,
  ctx,
  form,
  empty,
}: {
  tool: string;
  ctx: StudyContext;
  form: (api: { run: (a: RunArgs) => void; busy: boolean }) => ReactNode;
  empty: ReactNode;
}) {
  const history = useHistory<TextResult>(tool);
  const [current, setCurrent] = useState<{ id: string | null; data: TextResult } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const lastArgs = useRef<RunArgs | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(args: RunArgs) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    lastArgs.current = args;
    setError("");
    setStreaming(true);
    const data: TextResult = { request: args.request, content: "", extras: [], aliases: args.aliases };
    setCurrent({ id: null, data });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    try {
      const content = await streamPost(
        "/api/generate",
        { ...ctx, tool, ...args.body },
        (text) => setCurrent({ id: null, data: { ...data, content: text } }),
        ac.signal,
      );
      const final = { ...data, content };
      const id = history.add({ label: args.label, grade: ctx.grade, subject: ctx.subject, data: final });
      setCurrent({ id, data: final });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setCurrent((c) => (c && c.data.content ? c : null));
    } finally {
      if (abortRef.current === ac) setStreaming(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
    setCurrent((c) => (c && c.data.content ? c : null));
  }

  function open(item: HistoryItem<TextResult>) {
    if (streaming) stop();
    setError("");
    setCurrent({ id: item.id, data: item.data });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  return (
    <div>
      {form({ run, busy: streaming })}

      <div ref={resultRef} className="mt-6 scroll-mt-40 space-y-4">
        {streaming && (
          <div className="flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2">
              <Spinner className="text-brand-500" /> المساعد يكتب…
            </span>
            <Button variant="ghost" size="sm" onClick={stop}>
              ⏹ إيقاف
            </Button>
          </div>
        )}
        {error && <ErrorBox message={error} onRetry={lastArgs.current ? () => run(lastArgs.current!) : undefined} />}
        {current ? (
          <ResultView
            key={current.id ?? "live"}
            ctx={ctx}
            content={current.data.content}
            streaming={streaming}
            request={current.data.request}
            extras={current.data.extras}
            aliases={current.data.aliases}
            review={{ approved: current.data.approved, edited: current.data.edited }}
            onExtrasChange={(extras) => {
              const data = { ...current.data, extras };
              setCurrent({ ...current, data });
              if (current.id) history.update(current.id, data);
            }}
            onReviewChange={(patch) => {
              const data = { ...current.data, ...patch };
              setCurrent({ ...current, data });
              if (current.id) history.update(current.id, data);
            }}
          />
        ) : (
          !error && empty
        )}
      </div>

      <HistoryPanel
        items={history.items}
        activeId={current?.id}
        onOpen={open}
        onRemove={history.remove}
        onClear={history.clear}
      />
    </div>
  );
}
