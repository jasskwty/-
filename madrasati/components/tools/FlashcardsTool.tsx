"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyContext } from "@/lib/constants";
import type { FlashcardDeck } from "@/lib/types";
import { postJson } from "@/lib/client/stream";
import { useHistory, type HistoryItem } from "@/lib/client/storage";
import { HistoryPanel } from "../HistoryPanel";
import { InlineMarkdown } from "../Markdown";
import { MoreExplainer } from "../ResultView";
import { Button, Card, EmptyHint, ErrorBox, Field, Input, Loading, Segmented, cx } from "../ui";

interface DeckState {
  topic: string;
  deck: FlashcardDeck;
  known: number[]; // البطاقات اللي حفظها الطالب
  extras: string[];
}

export function FlashcardsTool({ ctx }: { ctx: StudyContext }) {
  const history = useHistory<DeckState>("flashcards");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [state, setState] = useState<{ id: string; data: DeckState } | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const touchX = useRef<number | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  function show(id: string, data: DeckState) {
    setState({ id, data });
    setOrder(data.deck.cards.map((_, i) => i));
    setPos(0);
    setFlipped(false);
  }

  async function generate() {
    if (!topic.trim() || loading) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    try {
      const deck = await postJson<FlashcardDeck>("/api/json", { ...ctx, tool: "flashcards", topic, count }, ac.signal);
      if (!deck.cards?.length) throw new Error("ما طلعت بطاقات. جرّب موضوع ثاني.");
      const data: DeckState = { topic, deck, known: [], extras: [] };
      const id = history.add({ label: deck.title || topic, grade: ctx.grade, subject: ctx.subject, data });
      show(id, data);
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

  const total = order.length;
  const go = useCallback(
    (delta: number) => {
      if (!total) return;
      setFlipped(false);
      // ننتظر نهاية حركة القلب قبل تغيير المحتوى عشان ما يبان الجواب
      setTimeout(() => setPos((p) => (p + delta + total) % total), flipped ? 180 : 0);
    },
    [total, flipped],
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // في الواجهة العربية: السهم الأيسر = التالي
      if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, go]);

  const cardIndex = order[pos];
  const card = state && cardIndex != null ? state.data.deck.cards[cardIndex] : null;
  const isKnown = state ? state.data.known.includes(cardIndex) : false;

  return (
    <div>
      <Card>
        <form
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <Field label="موضوع البطاقات" className="flex-1">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: الجدول الدوري، أو مفردات الوحدة الثالثة" maxLength={300} />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">العدد</span>
            <Segmented label="عدد البطاقات" value={count} onChange={setCount} options={[6, 10, 15, 20].map((n) => ({ value: n, label: n.toLocaleString("ar") }))} />
          </div>
          <Button type="submit" disabled={!topic.trim() || loading}>
            🃏 سوّ البطاقات
          </Button>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {loading && <Loading text="جاري تجهيز البطاقات…" />}
        {error && <ErrorBox message={error} onRetry={generate} />}
        {!state && !loading && !error && (
          <EmptyHint icon="🃏" title="بطاقات للمراجعة السريعة" text="اكتب الموضوع، واضغط على البطاقة عشان تقلبها وتشوف الجواب." />
        )}

        {state && card && (
          <div>
            <div className="mb-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span className="font-bold">{state.data.deck.title}</span>
              <span>
                {(pos + 1).toLocaleString("ar")} / {total.toLocaleString("ar")} · حفظت {state.data.known.length.toLocaleString("ar")}
              </span>
            </div>

            <div
              className="flip-scene mx-auto w-full max-w-xl"
              onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX.current == null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                touchX.current = null;
                if (Math.abs(dx) > 50) go(dx > 0 ? 1 : -1); // سحب لليمين = التالي (اتجاه عربي)
              }}
            >
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className={cx("flip-card relative block aspect-[3/2] w-full", flipped && "flipped")}
                aria-label={flipped ? "اقلب للسؤال" : "اقلب للجواب"}
                data-testid="flashcard"
              >
                <div className="flip-face absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-brand-200 bg-gradient-to-br from-white to-brand-50 p-6 shadow-lg dark:border-brand-800 dark:from-slate-900 dark:to-brand-950">
                  <span className="text-xs font-bold tracking-wide text-brand-600 dark:text-brand-300">السؤال</span>
                  <div className="text-center text-xl font-bold sm:text-2xl">
                    <InlineMarkdown>{card.front}</InlineMarkdown>
                  </div>
                  <span className="absolute bottom-4 text-xs text-slate-400">اضغط للقلب ↻</span>
                </div>
                <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow-lg dark:border-emerald-800 dark:from-slate-900 dark:to-emerald-950">
                  <span className="text-xs font-bold tracking-wide text-emerald-600 dark:text-emerald-300">الجواب</span>
                  <div className="max-h-full overflow-y-auto text-center text-base sm:text-lg">
                    <InlineMarkdown>{card.back}</InlineMarkdown>
                  </div>
                </div>
              </button>
            </div>

            <div className="mx-auto mt-4 flex max-w-xl items-center justify-between gap-2">
              <Button variant="secondary" onClick={() => go(-1)} aria-label="السابقة">
                → السابقة
              </Button>
              <Button
                variant={isKnown ? "primary" : "secondary"}
                size="sm"
                onClick={() =>
                  update({
                    ...state.data,
                    known: isKnown ? state.data.known.filter((k) => k !== cardIndex) : [...state.data.known, cardIndex],
                  })
                }
              >
                {isKnown ? "✅ حفظتها" : "☐ حفظتها"}
              </Button>
              <Button variant="secondary" onClick={() => go(1)} aria-label="التالية">
                التالية ←
              </Button>
            </div>
            <div className="mx-auto mt-3 flex max-w-xl flex-wrap justify-center gap-1.5" aria-label="البطاقات">
              {order.map((ci, p) => (
                <button
                  key={ci}
                  type="button"
                  onClick={() => {
                    setFlipped(false);
                    setPos(p);
                  }}
                  className={cx(
                    "size-2.5 rounded-full transition-all",
                    p === pos ? "w-6 bg-brand-600" : state.data.known.includes(ci) ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-700",
                  )}
                  aria-label={`بطاقة ${p + 1}`}
                />
              ))}
            </div>

            <Card className="mt-6">
              <details>
                <summary className="cursor-pointer font-bold">📋 عرض كل البطاقات ({total})</summary>
                <ol className="mt-3 space-y-2">
                  {state.data.deck.cards.map((c, i) => (
                    <li key={i} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <div className="font-bold">
                        <InlineMarkdown>{c.front}</InlineMarkdown>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        <InlineMarkdown>{c.back}</InlineMarkdown>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
              <MoreExplainer
                ctx={ctx}
                source={`${state.data.deck.title}\n\n${state.data.deck.cards.map((c, i) => `${i + 1}. ${c.front}\n   ${c.back}`).join("\n")}`}
                request={`بطاقات مراجعة في: ${state.data.topic}. اشرح المفاهيم بتفصيل أكثر.`}
                extras={state.data.extras}
                onExtrasChange={(extras) => update({ ...state.data, extras })}
                actionsExtra={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const shuffled = [...order].sort(() => Math.random() - 0.5);
                      setOrder(shuffled);
                      setPos(0);
                      setFlipped(false);
                    }}
                  >
                    🔀 خلط
                  </Button>
                }
              />
            </Card>
          </div>
        )}
      </div>

      <HistoryPanel
        items={history.items}
        activeId={state?.id}
        onOpen={(it: HistoryItem<DeckState>) => show(it.id, it.data)}
        onRemove={history.remove}
        onClear={history.clear}
      />
    </div>
  );
}
