"use client";
import { useEffect, useRef, useState } from "react";
import type { StudyContext } from "@/lib/constants";
import type { Quiz } from "@/lib/types";
import { postJson } from "@/lib/client/stream";
import { useHistory, type HistoryItem } from "@/lib/client/storage";
import { HistoryPanel } from "../HistoryPanel";
import { InlineMarkdown } from "../Markdown";
import { MoreExplainer } from "../ResultView";
import { Button, Card, EmptyHint, ErrorBox, Field, Input, Loading, Segmented, cx } from "../ui";

interface QuizState {
  topic: string;
  quiz: Quiz;
  answers: (number | null)[];
  extras: string[];
}

const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];

function quizToText(s: QuizState) {
  return s.quiz.questions
    .map((q, i) => {
      const a = s.answers[i];
      const status = a == null ? "لم يجب" : a === q.correct_index ? "صح" : `خطأ (اختار: ${q.options[a]})`;
      return `س${i + 1}: ${q.question}\nالإجابة الصحيحة: ${q.options[q.correct_index]}\nإجابة الطالب: ${status}\nالشرح: ${q.explanation}`;
    })
    .join("\n\n");
}

export function QuizTool({ ctx }: { ctx: StudyContext }) {
  const history = useHistory<QuizState>("quiz");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [state, setState] = useState<{ id: string; data: QuizState } | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function start() {
    if (!topic.trim() || loading) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    setState(null);
    try {
      const quiz = await postJson<Quiz>("/api/json", { ...ctx, tool: "quiz", topic, count, difficulty }, ac.signal);
      const data: QuizState = { topic, quiz, answers: quiz.questions.map(() => null), extras: [] };
      const id = history.add({ label: quiz.title || topic, grade: ctx.grade, subject: ctx.subject, data });
      setState({ id, data });
      setIndex(0);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function update(data: QuizState) {
    if (!state) return;
    setState({ ...state, data });
    history.update(state.id, data);
  }

  function open(item: HistoryItem<QuizState>) {
    setState({ id: item.id, data: item.data });
    const firstOpen = item.data.answers.findIndex((a) => a == null);
    setIndex(firstOpen === -1 ? item.data.quiz.questions.length : firstOpen);
    setError("");
  }

  const total = state?.data.quiz.questions.length ?? 0;
  const done = state ? state.data.answers.every((a) => a != null) : false;
  const score = state ? state.data.answers.filter((a, i) => a === state.data.quiz.questions[i].correct_index).length : 0;
  const showResult = state && index >= total;

  return (
    <div>
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <Field label="موضوع الاختبار">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: الكسور العشرية، أو الوحدة الثانية" maxLength={300} />
          </Field>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div>
              <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">عدد الأسئلة</span>
              <Segmented
                label="عدد الأسئلة"
                value={count}
                onChange={setCount}
                options={[5, 10, 15, 20].map((n) => ({ value: n, label: n.toLocaleString("ar") }))}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">الصعوبة</span>
              <Segmented
                label="الصعوبة"
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: "easy", label: "سهل" },
                  { value: "medium", label: "متوسط" },
                  { value: "hard", label: "صعب" },
                ]}
              />
            </div>
            <Button type="submit" disabled={!topic.trim() || loading} className="ms-auto">
              🎯 ابدأ الاختبار
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {loading && <Loading text="جاري تجهيز الأسئلة…" />}
        {error && <ErrorBox message={error} onRetry={start} />}
        {!state && !loading && !error && (
          <EmptyHint icon="🎯" title="اختبر نفسك" text="اختر الموضوع وعدد الأسئلة والصعوبة، وجاوب. التصحيح فوري مع شرح لكل سؤال." />
        )}

        {state && !showResult && (() => {
          const q = state.data.quiz.questions[index];
          const ans = state.data.answers[index];
          const answered = ans != null;
          return (
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-bold">{state.data.quiz.title}</span>
                <span>
                  سؤال {(index + 1).toLocaleString("ar")} من {total.toLocaleString("ar")}
                </span>
              </div>
              <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }} />
              </div>
              <div className="mb-4 text-lg font-bold">
                <InlineMarkdown>{q.question}</InlineMarkdown>
              </div>
              <div className="grid gap-2">
                {q.options.map((opt, i) => {
                  const isCorrect = i === q.correct_index;
                  const isChosen = i === ans;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={answered}
                      onClick={() => {
                        const answers = [...state.data.answers];
                        answers[index] = i;
                        update({ ...state.data, answers });
                      }}
                      className={cx(
                        "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-start transition-colors",
                        !answered && "border-slate-200 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-900/20",
                        answered && isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
                        answered && isChosen && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-950/40",
                        answered && !isCorrect && !isChosen && "border-slate-200 opacity-60 dark:border-slate-700",
                      )}
                    >
                      <span
                        className={cx(
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          answered && isCorrect ? "bg-emerald-500 text-white" : answered && isChosen ? "bg-red-500 text-white" : "bg-slate-100 dark:bg-slate-800",
                        )}
                      >
                        {answered && isCorrect ? "✓" : answered && isChosen ? "✗" : LETTERS[i]}
                      </span>
                      <span className="flex-1">
                        <InlineMarkdown>{opt}</InlineMarkdown>
                      </span>
                    </button>
                  );
                })}
              </div>
              {answered && (
                <div
                  className={cx(
                    "mt-4 rounded-xl p-4",
                    ans === q.correct_index ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30",
                  )}
                  role="status"
                >
                  <div className="mb-1 font-bold">{ans === q.correct_index ? "🎉 إجابة صحيحة!" : "❌ إجابة خاطئة"}</div>
                  <InlineMarkdown>{q.explanation}</InlineMarkdown>
                </div>
              )}
              <div className="mt-5 flex justify-between gap-2">
                <Button variant="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
                  → السابق
                </Button>
                <Button onClick={() => setIndex((i) => i + 1)} disabled={!answered}>
                  {index === total - 1 ? "🏁 النتيجة" : "التالي ←"}
                </Button>
              </div>
            </Card>
          );
        })()}

        {state && showResult && (
          <Card>
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="text-5xl" aria-hidden>
                {score / total >= 0.9 ? "🏆" : score / total >= 0.6 ? "👏" : "💪"}
              </span>
              <div className="text-3xl font-extrabold">
                {score.toLocaleString("ar")} / {total.toLocaleString("ar")}
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                {Math.round((score / total) * 100).toLocaleString("ar")}٪ —{" "}
                {score / total >= 0.9 ? "ممتاز! ما شاء الله" : score / total >= 0.6 ? "زين، كمّل كذا" : "لا تشيل هم، راجع الأخطاء وجرّب مرة ثانية"}
              </div>
              {!done && <div className="text-sm text-amber-600">فيه أسئلة ما جاوبت عليها</div>}
            </div>
            <ol className="mt-4 space-y-3">
              {state.data.quiz.questions.map((q, i) => {
                const a = state.data.answers[i];
                const ok = a === q.correct_index;
                return (
                  <li key={i} className={cx("rounded-xl border p-3", ok ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900")}>
                    <button type="button" className="w-full text-start" onClick={() => setIndex(i)}>
                      <div className="flex gap-2 font-bold">
                        <span>{ok ? "✅" : "❌"}</span>
                        <InlineMarkdown>{q.question}</InlineMarkdown>
                      </div>
                      {!ok && (
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          الصحيح: <InlineMarkdown>{q.options[q.correct_index]}</InlineMarkdown>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
            <MoreExplainer
              ctx={ctx}
              source={`نتيجة اختبار «${state.data.quiz.title}»: ${score} من ${total}\n\n${quizToText(state.data)}`}
              request={`اختبار في: ${state.data.topic}. اشرح لي الأسئلة اللي غلطت فيها والمفاهيم اللي أحتاج أراجعها.`}
              extras={state.data.extras}
              onExtrasChange={(extras) => update({ ...state.data, extras })}
              actionsExtra={
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      update({ ...state.data, answers: state.data.quiz.questions.map(() => null) });
                      setIndex(0);
                    }}
                  >
                    🔁 أعد الاختبار
                  </Button>
                  <Button variant="ghost" size="sm" onClick={start} disabled={!topic.trim()}>
                    🆕 أسئلة جديدة
                  </Button>
                </>
              }
            />
          </Card>
        )}
      </div>

      <HistoryPanel items={history.items} activeId={state?.id} onOpen={open} onRemove={history.remove} onClear={history.clear} />
    </div>
  );
}
