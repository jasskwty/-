"use client";
import { useEffect, useMemo, useState } from "react";
import type { StudyContext } from "@/lib/constants";
import { normalizeAr } from "@/lib/subjectMatch";
import { currentTerm, useApp } from "@/lib/client/appContext";
import { moeCatalog, skwFiles, skwSubjects, type MoeCatalog, type MoeItem, type SkwFiles, type SkwSubjects } from "@/lib/client/library";
import { Dialog, PagesStep } from "../LibraryPicker";
import { Button, Card, EmptyHint, ErrorBox, Input, Loading, Segmented, Select, cx } from "../ui";

type Source = "moe" | "skw";

const matchesQuery = (title: string, q: string) => !q.trim() || normalizeAr(title).includes(normalizeAr(q));

/**
 * 📚 المكتبة: كتب ومصادر وزارة التربية، وفهرس ملفات موقع مدرستي.
 * ملفات الوزارة ممكن نستخدم صفحات منها مع المساعد، وملفات مدرستي تفتح في موقعهم.
 */
export function LibraryTool({ ctx }: { ctx: StudyContext }) {
  const teacher = ctx.role === "teacher";
  const [source, setSource] = useState<Source>("moe");
  const [term, setTerm] = useState<1 | 2>(currentTerm());
  const [q, setQ] = useState("");

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="المصدر"
            value={source}
            onChange={setSource}
            options={[
              { value: "moe", label: "🏛️ مكتبة وزارة التربية" },
              { value: "skw", label: "🏫 ملفات مدرستي" },
            ]}
          />
          <Segmented label="الفصل الدراسي" value={term} onChange={setTerm} options={[{ value: 1, label: "الفصل الأول" }, { value: 2, label: "الفصل الثاني" }]} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ابحث في العناوين…" aria-label="ابحث في العناوين" className="min-w-40 flex-1" />
        </div>
      </Card>
      {source === "moe" ? <MoeView ctx={ctx} term={term} q={q} teacher={teacher} /> : <SkwView ctx={ctx} term={term} q={q} />}
    </div>
  );
}

// ===== مكتبة الوزارة =====
function MoeView({ ctx, term, q, teacher }: { ctx: StudyContext; term: 1 | 2; q: string; teacher: boolean }) {
  const app = useApp();
  const [lib, setLib] = useState<"student" | "teacher">(teacher ? "teacher" : "student");
  const [cat, setCat] = useState<MoeCatalog | null>(null);
  const [subj, setSubj] = useState("auto");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [picking, setPicking] = useState<MoeItem | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setCat(null);
    setError("");
    moeCatalog(ctx.grade, term, lib === "teacher", ctx.subject)
      .then((c) => alive && setCat(c))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [ctx.grade, ctx.subject, term, lib, reload]);

  useEffect(() => setSubj("auto"), [ctx.subject, ctx.grade]);

  const ids = useMemo(() => {
    if (!cat) return new Set<number>();
    if (subj === "all") return new Set(cat.subjects.map((s) => s.id));
    if (subj !== "auto") return new Set([Number(subj)]);
    return new Set(cat.subjects.filter((s) => s.match).map((s) => s.id));
  }, [cat, subj]);

  const subjName = (id: number) => cat?.subjects.find((s) => s.id === id)?.name ?? "";
  const books = cat?.books.filter((b) => ids.has(b.subjectId) && matchesQuery(b.title, q)) ?? [];
  const exams = cat?.exams.filter((b) => ids.has(b.subjectId) && matchesQuery(b.title, q)) ?? [];
  const videos = cat?.videos.filter((v) => ids.has(v.subjectId) && matchesQuery(v.title, q)) ?? [];

  const jumpTargets = teacher
    ? [
        { id: "t-lesson", label: "📋 حضّر درس منها" },
        { id: "t-worksheet", label: "📄 سوّ أسئلة منها" },
        { id: "t-simplify", label: "🪜 بسّطها" },
      ]
    : [
        { id: "summarize", label: "📝 لخّصها" },
        { id: "chat", label: "💬 اسأل عنها" },
        { id: "solve", label: "✏️ حل منها" },
      ];

  function ItemRow({ item }: { item: MoeItem }) {
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-2xl" aria-hidden>
          {item.kind === "book" ? (item.label === "دليل المعلم" ? "🧑‍🏫" : item.label ? "🗂️" : "📘") : item.label === "أوراق عمل" ? "📝" : "🔁"}
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <div className="font-medium">{item.title}</div>
          <div className="text-xs text-slate-500">
            {subjName(item.subjectId)}
            {item.label && ` · ${item.label}`}
          </div>
        </div>
        <div className="flex w-full justify-end gap-1 sm:w-auto">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-xl px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            فتح ↗
          </a>
          <Button size="sm" variant="secondary" onClick={() => setPicking(item)}>
            📎 صفحات للمساعد
          </Button>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {teacher && (
          <Segmented
            label="المكتبة"
            value={lib}
            onChange={setLib}
            options={[
              { value: "teacher", label: "🧑‍🏫 مكتبة المعلم (الأدلة وخطط التوزيع)" },
              { value: "student", label: "🎒 كتب الطالب" },
            ]}
          />
        )}
        {cat && (
          <Select value={subj} onChange={(e) => setSubj(e.target.value)} aria-label="المادة في مكتبة الوزارة" className="w-auto min-w-48 flex-1">
            <option value="auto">المادة الحالية: {cat.subjects.filter((s) => s.match).map((s) => s.name).join("، ") || "ما فيه تطابق"}</option>
            <option value="all">كل المواد</option>
            {cat.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {added && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40" role="status">
          <div className="font-bold text-emerald-800 dark:text-emerald-200">✅ جهّزنا «{added}»</div>
          <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">بتلقاها جاهزة تحت زر الرفع في أي أداة. وين تبي تستخدمها؟</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {jumpTargets.map((t) => (
              <Button key={t.id} size="sm" variant="secondary" onClick={() => app?.goToTab(t.id)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={() => setReload((r) => r + 1)} />}
      {!cat && !error && <Loading text="جاري جلب فهرس مكتبة وزارة التربية…" />}
      {cat && books.length + exams.length + videos.length === 0 && (
        <EmptyHint icon="🔎" title="ما لقينا شي" text="جرّب الفصل الثاني، أو اختر «كل المواد»، أو غيّر كلمة البحث." />
      )}

      {books.length > 0 && (
        <Section title={lib === "teacher" ? "🧑‍🏫 أدلة المعلم وخطط التوزيع" : "📘 الكتب المدرسية"} count={books.length}>
          {books.map((b) => (
            <ItemRow key={`b${b.id}`} item={b} />
          ))}
        </Section>
      )}
      {exams.length > 0 && (
        <Section title="📝 أوراق عمل ومراجعات" count={exams.length}>
          {exams.map((b) => (
            <ItemRow key={`e${b.id}`} item={b} />
          ))}
        </Section>
      )}
      {videos.length > 0 && (
        <Card className="p-4 sm:p-4">
          <div className="mb-3 font-bold">🎬 فيديوهات الدروس ({videos.length})</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos.map((v) => (
              <a
                key={v.id}
                href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                target="_blank"
                rel="noreferrer noopener"
                className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-full object-cover transition group-hover:opacity-90" />
                <div className="p-2 text-sm">
                  <div className="line-clamp-2 font-medium">▶ {v.title}</div>
                  <div className="text-xs text-slate-500">{subjName(v.subjectId)}</div>
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

      {cat && (
        <p className="text-xs text-slate-500">
          المصدر:{" "}
          <a href={cat.source} target="_blank" rel="noreferrer noopener" className="underline">
            مكتبة وزارة التربية الإلكترونية
          </a>
          . الملفات تفتح من موقع الوزارة، وحقوقها محفوظة للوزارة.
        </p>
      )}

      {picking && (
        <Dialog title="📎 اختر الصفحات" onClose={() => setPicking(null)}>
          <PagesStep
            item={picking}
            onAdd={(img) => {
              app?.addToInbox(img);
              setAdded(img.name ?? picking.title);
              setPicking(null);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="p-0 sm:p-0">
      <div className="border-b border-slate-100 px-4 py-3 font-bold dark:border-slate-800">
        {title} ({count})
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>
    </Card>
  );
}

// ===== موقع مدرستي (فهرس وروابط فقط) =====
function SkwView({ ctx, term, q }: { ctx: StudyContext; term: 1 | 2; q: string }) {
  const [subs, setSubs] = useState<SkwSubjects | null>(null);
  const [section, setSection] = useState<number | null>(null);
  const [files, setFiles] = useState<SkwFiles | null>(null);
  const [type, setType] = useState("الكل");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setSubs(null);
    setFiles(null);
    setError("");
    skwSubjects(ctx.grade, term, ctx.subject)
      .then((s) => {
        if (!alive) return;
        setSubs(s);
        setSection(s.subjects.find((x) => x.match)?.id ?? s.subjects[0]?.id ?? null);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [ctx.grade, ctx.subject, term, reload]);

  useEffect(() => {
    if (section == null) return;
    let alive = true;
    setFiles(null);
    setType("الكل");
    skwFiles(section, term)
      .then((f) => alive && setFiles(f))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [section, term]);

  const types = files ? ["الكل", ...Array.from(new Set(files.files.map((f) => f.type)))] : [];
  const shown = files?.files.filter((f) => (type === "الكل" || f.type === type) && matchesQuery(f.title, q)) ?? [];

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        🏫 ملفات موقع «مدرستي» (school-kw.com) من إعداد معلمين، وتفتح في موقعهم. إذا تبي تستخدم ملف مع المساعد، نزّله من هناك وارفعه بزر 📎 في الأداة.
      </p>
      {subs && (
        <Select value={section ?? ""} onChange={(e) => setSection(Number(e.target.value))} aria-label="المادة في موقع مدرستي">
          {subs.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.match ? " ✓" : ""}
            </option>
          ))}
        </Select>
      )}
      {files && types.length > 2 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="نوع الملف">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cx(
                "rounded-full border px-3 py-1 text-sm font-bold",
                type === t ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {error && <ErrorBox message={error} onRetry={() => setReload((r) => r + 1)} />}
      {(!subs || (section != null && !files)) && !error && <Loading text="جاري جلب الفهرس من موقع مدرستي…" />}
      {files && shown.length === 0 && <EmptyHint icon="🔎" title="ما لقينا ملفات" text="جرّب نوع ثاني أو الفصل الثاني أو كلمة بحث ثانية." />}
      {shown.length > 0 && (
        <Section title={`📂 ${files!.title}`} count={shown.length}>
          {shown.map((f) => (
            <li key={f.id}>
              <a href={f.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold dark:bg-slate-800">{f.type}</span>
                <span className="min-w-0 flex-1">{f.title}</span>
                <span className="text-sm text-brand-600 dark:text-brand-300">فتح ↗</span>
              </a>
            </li>
          ))}
        </Section>
      )}
      {files && (
        <p className="text-xs text-slate-500">
          المصدر:{" "}
          <a href={files.source} target="_blank" rel="noreferrer noopener" className="underline">
            موقع مدرستي school-kw.com
          </a>
          . الحقوق محفوظة لأصحاب الملفات.
        </p>
      )}
    </div>
  );
}
