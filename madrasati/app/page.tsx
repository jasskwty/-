"use client";
import { useEffect, useState } from "react";
import { GRADES, SUBJECTS, type GradeId, type SubjectId } from "@/lib/constants";
import { useStored } from "@/lib/client/storage";
import { cx } from "@/components/ui";
import { ChatTool } from "@/components/tools/ChatTool";
import { EssayTool, ExplainTool, ScheduleTool, SolveTool, SummarizeTool } from "@/components/tools/TextTools";
import { QuizTool } from "@/components/tools/QuizTool";
import { FlashcardsTool } from "@/components/tools/FlashcardsTool";
import { PresentationTool } from "@/components/tools/PresentationTool";

const TABS = [
  { id: "chat", label: "اسأل المعلم", icon: "💬", Comp: ChatTool },
  { id: "explain", label: "اشرح درس", icon: "📘", Comp: ExplainTool },
  { id: "solve", label: "حل واجب", icon: "✏️", Comp: SolveTool },
  { id: "quiz", label: "اختبرني", icon: "🎯", Comp: QuizTool },
  { id: "flashcards", label: "بطاقات مراجعة", icon: "🃏", Comp: FlashcardsTool },
  { id: "summarize", label: "لخّص", icon: "📝", Comp: SummarizeTool },
  { id: "essay", label: "صحّح تعبيري", icon: "🖊️", Comp: EssayTool },
  { id: "presentation", label: "برزنتيشن", icon: "🎞️", Comp: PresentationTool },
  { id: "schedule", label: "جدول مذاكرة", icon: "🗓️", Comp: ScheduleTool },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Theme = "light" | "dark" | "system";

function ThemeToggle() {
  const [theme, setTheme, ready] = useStored<Theme>("theme", "system");
  useEffect(() => {
    if (!ready) return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, ready]);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const label: Record<Theme, string> = { system: "🖥️ تلقائي", light: "☀️ فاتح", dark: "🌙 داكن" };
  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      aria-label="تغيير المظهر"
      title="تغيير المظهر"
    >
      {label[theme]}
    </button>
  );
}

export default function Home() {
  const [grade, setGrade] = useStored<GradeId>("grade", "10");
  const [subject, setSubject] = useStored<SubjectId>("subject", "math");
  const [tab, setTab] = useStored<TabId>("tab", "chat");
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set());

  // نخلي الأدوات اللي انفتحت محمّلة عشان ما تضيع نتائجها عند التنقل
  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab)));
  }, [tab]);

  const ctx = { grade, subject };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center justify-between gap-3 pt-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-xl text-white shadow-sm shadow-brand-600/30" aria-hidden>
                🎓
              </span>
              <div>
                <h1 className="text-lg leading-tight font-extrabold sm:text-xl">مساعدي المدرسي</h1>
                <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">رفيقك في المذاكرة من السادس إلى الثاني عشر</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">الصف</span>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as GradeId)}
                className="w-full cursor-pointer bg-transparent py-1 font-bold focus:outline-none dark:[color-scheme:dark]"
                aria-label="الصف"
              >
                {GRADES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">المادة</span>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as SubjectId)}
                className="w-full cursor-pointer bg-transparent py-1 font-bold focus:outline-none dark:[color-scheme:dark]"
                aria-label="المادة"
              >
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <nav className="no-scrollbar -mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2" role="tablist" aria-label="الأدوات">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap transition-colors",
                  tab === t.id
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
        {TABS.map(({ id, Comp }) =>
          visited.has(id) || id === tab ? (
            <section key={id} role="tabpanel" hidden={id !== tab} aria-label={TABS.find((t) => t.id === id)?.label}>
              <Comp ctx={ctx} />
            </section>
          ) : null,
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-slate-400">
        المساعد ممكن يغلط أحياناً، راجع المعلومات المهمة مع معلمك وكتابك المدرسي.
      </footer>
    </div>
  );
}
