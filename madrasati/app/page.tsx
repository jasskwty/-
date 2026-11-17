"use client";
import { useCallback, useEffect, useState } from "react";
import { GRADES, SUBJECTS, type GradeId, type Role, type SubjectId } from "@/lib/constants";
import { useStored } from "@/lib/client/storage";
import { cx } from "@/components/ui";
import { ChatTool } from "@/components/tools/ChatTool";
import { EssayTool, ExplainTool, ScheduleTool, SolveTool, SummarizeTool } from "@/components/tools/TextTools";
import { QuizTool } from "@/components/tools/QuizTool";
import { FlashcardsTool } from "@/components/tools/FlashcardsTool";
import { PresentationTool } from "@/components/tools/PresentationTool";
import {
  CommentsTool,
  DifferentiateTool,
  GradeTool,
  LessonPlanTool,
  RubricTool,
  ScaffoldTool,
  SimplifyTool,
  WorksheetTool,
} from "@/components/tools/TeacherTools";
import { TrackerTool } from "@/components/tools/TrackerTool";
import { PrivacyPanel, ReferencePanel } from "@/components/TeacherPanels";
import { LibraryTool } from "@/components/tools/LibraryTool";
import { AppProvider } from "@/lib/client/appContext";

const STUDENT_TABS = [
  { id: "chat", label: "اسأل المعلم", icon: "💬", Comp: ChatTool },
  { id: "explain", label: "اشرح درس", icon: "📘", Comp: ExplainTool },
  { id: "solve", label: "حل واجب", icon: "✏️", Comp: SolveTool },
  { id: "quiz", label: "اختبرني", icon: "🎯", Comp: QuizTool },
  { id: "flashcards", label: "بطاقات مراجعة", icon: "🃏", Comp: FlashcardsTool },
  { id: "summarize", label: "لخّص", icon: "📝", Comp: SummarizeTool },
  { id: "essay", label: "صحّح تعبيري", icon: "🖊️", Comp: EssayTool },
  { id: "presentation", label: "برزنتيشن", icon: "🎞️", Comp: PresentationTool },
  { id: "schedule", label: "جدول مذاكرة", icon: "🗓️", Comp: ScheduleTool },
  { id: "library", label: "المكتبة", icon: "📚", Comp: LibraryTool },
] as const;

// أدوات المعلم (معرّفاتها مختلفة عشان كل أداة تحتفظ بحالتها الخاصة)
const TEACHER_TABS = [
  { id: "t-chat", label: "مساعد تربوي", icon: "💬", Comp: ChatTool },
  { id: "t-library", label: "مصادر الوزارة", icon: "📚", Comp: LibraryTool },
  // ١. التحضير وتصميم المحتوى
  { id: "t-lesson", label: "تحضير درس", icon: "📋", Comp: LessonPlanTool },
  { id: "t-diff", label: "أنشطة وتجارب", icon: "🧩", Comp: DifferentiateTool },
  { id: "t-simplify", label: "تبسيط المحتوى", icon: "🪜", Comp: SimplifyTool },
  { id: "t-presentation", label: "برزنتيشن", icon: "🎞️", Comp: PresentationTool },
  // ٢. التقييم والتصحيح
  { id: "t-worksheet", label: "أسئلة واختبارات", icon: "📄", Comp: WorksheetTool },
  { id: "t-grade", label: "تصحيح إجابات", icon: "✅", Comp: GradeTool },
  { id: "t-rubric", label: "سلّم تقدير", icon: "📏", Comp: RubricTool },
  // ٣. التخصيص ودعم الطلاب
  { id: "t-tracker", label: "سجل الطلاب", icon: "📊", Comp: TrackerTool },
  { id: "t-scaffold", label: "دعم الاحتياجات", icon: "🤝", Comp: ScaffoldTool },
  // ٤. الأعمال الإدارية
  { id: "t-comments", label: "رسائل وتقارير", icon: "✉️", Comp: CommentsTool },
] as const;

const ALL_TABS = [...STUDENT_TABS, ...TEACHER_TABS];

const TAB_DESC: Record<string, string> = {
  chat: "اسأل أي سؤال في مادتك، وارفع صورة من الكتاب أو الواجب",
  explain: "شرح خطوة بخطوة مع أمثلة محلولة وأسئلة تدريب",
  solve: "اكتب السؤال أو صوّره، ويطلع لك الحل بالخطوات",
  quiz: "اختبر نفسك وشوف تصحيحك على طول",
  flashcards: "بطاقات تقلبها للحفظ السريع",
  summarize: "ملخص بنقاط وتعاريف وقوانين من أي نص أو صورة",
  essay: "تصحيح تعبيرك مع درجة من ١٠ ونسخة محسّنة",
  presentation: "عرض جاهز: باوربوينت أو صفحة تفاعلية",
  schedule: "جدول مذاكرة يومي حسب مواعيد اختباراتك",
  library: "كتب الوزارة وملفات مدرستي حسب صفك ومادتك",
  "t-chat": "أفكار للشرح والأنشطة وإدارة الصف",
  "t-library": "دليل المعلم، وخطط التوزيع، وكتب الطالب، والمراجعات",
  "t-lesson": "تحضير كامل بسير الحصة بالدقائق، من صفحات الكتاب",
  "t-diff": "أنشطة متمايزة، وألعاب، وتجارب، ووسائل",
  "t-simplify": "نفس المحتوى بعدة مستويات قراءة",
  "t-presentation": "عرض للحصة: باوربوينت أو صفحة تفاعلية",
  "t-worksheet": "أوراق عمل، واختبارات، وبنك أسئلة بمستويات التفكير",
  "t-grade": "تصحيح من النص أو صورة الورقة، مع ملاحظة للطالب",
  "t-rubric": "معايير واضحة بمستويات أداء",
  "t-tracker": "الفصول والدرجات والتحليل والمتابعات، وتصوير الكشف",
  "t-scaffold": "سقالات تعليمية وتكييفات حسب الاحتياج",
  "t-comments": "رسائل أولياء الأمور والتقارير الدورية",
};

// مفاتيح سجلات أدوات المعلم (لزر حذف بيانات المعلم)
const TEACHER_TOOL_KEYS = [
  "lessonPlan", "worksheet", "grade", "rubric", "differentiate", "comments",
  "simplify", "scaffold", "tracker", "teacher:presentation",
];
type TabId = (typeof ALL_TABS)[number]["id"];

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
  const icon: Record<Theme, string> = { system: "🖥️", light: "☀️", dark: "🌙" };
  const label: Record<Theme, string> = { system: "تلقائي", light: "فاتح", dark: "داكن" };
  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      aria-label="تغيير المظهر"
      title="تغيير المظهر"
    >
      {icon[theme]}
      <span className="hidden sm:inline"> {label[theme]}</span>
    </button>
  );
}

export default function Home() {
  const [grade, setGrade] = useStored<GradeId>("grade", "10");
  const [subject, setSubject] = useStored<SubjectId>("subject", "math");
  const [role, setRole] = useStored<Role>("role", "student");
  const [studentTab, setStudentTab] = useStored<TabId>("tab", "chat");
  const [teacherTab, setTeacherTab] = useStored<TabId>("teacher:tab", "t-chat");
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set());
  const teacher = role === "teacher";
  const TABS = teacher ? TEACHER_TABS : STUDENT_TABS;
  const stored = teacher ? teacherTab : studentTab;
  const tab: TabId = TABS.some((t) => t.id === stored) ? stored : TABS[0].id;
  const setTab = teacher ? setTeacherTab : setStudentTab;

  // نخلي الأدوات اللي انفتحت محمّلة عشان ما تضيع نتائجها عند التنقل
  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab)));
  }, [tab]);

  const [reference, setReference] = useStored<string>(`teacher:reference:${grade}:${subject}`, "");
  const ctx = { grade, subject, role };
  const teacherCtx = { ...ctx, role: "teacher" as const, reference };
  const goToTab = useCallback(
    (id: string) => {
      const target = ALL_TABS.find((t) => t.id === id);
      if (!target) return;
      if (id.startsWith("t-")) {
        setRole("teacher");
        setTeacherTab(target.id);
      } else {
        setRole("student");
        setStudentTab(target.id);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <AppProvider ctx={teacher ? teacherCtx : ctx} goToTab={goToTab}>
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 shadow-[0_1px_0_rgb(93_69_230/0.06)] backdrop-blur-xl dark:border-white/5 dark:bg-slate-950/60">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center justify-between gap-3 pt-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 via-fuchsia-500 to-sky-400 text-xl text-white shadow-lg shadow-brand-600/30" aria-hidden>
                🎓
              </span>
              <div>
                <h1 className="text-gradient font-display text-lg leading-tight font-extrabold whitespace-nowrap sm:text-2xl">مساعدي المدرسي</h1>
                <p className="mt-1 hidden text-xs text-slate-500 sm:block dark:text-slate-400">
                  {teacher ? "مساعدك في التحضير والتدريس والتقويم" : "رفيقك في المذاكرة من السادس إلى الثاني عشر"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div role="group" aria-label="الوضع" className="flex rounded-2xl bg-slate-100/80 p-1 text-sm font-bold ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10">
                {(
                  [
                    { value: "student", icon: "🎒", label: "طالب" },
                    { value: "teacher", icon: "👩‍🏫", label: "معلم" },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={role === r.value}
                    onClick={() => setRole(r.value)}
                    className={cx(
                      "rounded-xl px-3 py-1 transition-all",
                      role === r.value
                        ? "bg-linear-to-l from-brand-600 to-fuchsia-500 text-white shadow-md shadow-brand-600/30"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
                    )}
                  >
                    <span className="hidden sm:inline" aria-hidden>
                      {r.icon}{" "}
                    </span>
                    {r.label}
                  </button>
                ))}
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">الصف{teacher && <span className="hidden sm:inline"> المستهدف</span>}</span>
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

          <nav className="no-scrollbar -mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2 lg:flex-wrap lg:overflow-visible" role="tablist" aria-label="الأدوات">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-all",
                  tab === t.id
                    ? "bg-linear-to-l from-brand-600 via-brand-500 to-fuchsia-500 text-white shadow-lg shadow-brand-600/30"
                    : "text-slate-600 hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:ring-white/10",
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
        {(() => {
          const cur = TABS.find((t) => t.id === tab);
          return cur ? (
            <div className="mb-5 flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-white/80 text-3xl shadow-[0_10px_30px_-10px_rgb(93_69_230/0.45)] ring-1 ring-brand-100 dark:bg-white/5 dark:ring-white/10" aria-hidden>
                {cur.icon}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-2xl leading-tight font-extrabold text-slate-900 sm:text-3xl dark:text-white">{cur.label}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{TAB_DESC[cur.id]}</p>
              </div>
            </div>
          ) : null;
        })()}
        {teacher && (
          <div className="mb-5 grid gap-2 md:grid-cols-2 md:items-start">
            <ReferencePanel ctx={{ ...ctx, role: "teacher" }} value={reference} onChange={setReference} />
            <PrivacyPanel teacherTools={TEACHER_TOOL_KEYS} />
          </div>
        )}
        {ALL_TABS.map(({ id, label, Comp }) =>
          visited.has(id) || id === tab ? (
            <section key={id} role="tabpanel" hidden={id !== tab} aria-label={label}>
              <Comp
                ctx={id.startsWith("t-") ? { ...ctx, role: "teacher", reference } : { ...ctx, role: "student" }}
              />
            </section>
          ) : null,
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-slate-400">
        {teacher
          ? "المساعد ممكن يغلط أحياناً، راجع المحتوى قبل استخدامه مع الطلاب وطابقه مع دليل المعلم."
          : "المساعد ممكن يغلط أحياناً، راجع المعلومات المهمة مع معلمك وكتابك المدرسي."}
      </footer>
    </div>
    </AppProvider>
  );
}
