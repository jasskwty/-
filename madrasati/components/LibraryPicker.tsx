"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PDF_TYPE } from "@/lib/constants";
import { currentTerm, useApp } from "@/lib/client/appContext";
import type { PickedImage } from "@/lib/client/image";
import { moeCatalog, moePageCount, moePages, type MoeCatalog, type MoeItem } from "@/lib/client/library";
import { Button, ErrorBox, Input, Loading, Segmented, Select, Spinner, cx } from "./ui";

/** نافذة منبثقة بسيطة */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** اختيار نطاق صفحات من ملف في مكتبة الوزارة */
export function PagesStep({ item, onAdd, onBack }: { item: MoeItem; onAdd: (img: PickedImage) => void; onBack?: () => void }) {
  const [total, setTotal] = useState<number | null>(null);
  const [max, setMax] = useState(20);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("10");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    moePageCount(item.kind, item.id)
      .then((r) => {
        if (!alive) return;
        setTotal(r.total);
        setMax(r.maxPages);
        setTo(String(Math.min(r.total, 10)));
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [item]);

  const f = Number(from);
  const t = Number(to);
  const valid = total != null && f >= 1 && t >= f && t <= total && t - f + 1 <= max;

  async function add() {
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      const r = await moePages(item.kind, item.id, f, t);
      onAdd({
        id: `moe-${item.kind}-${item.id}-${r.from}-${r.to}`,
        media_type: PDF_TYPE,
        data: r.data,
        preview: "",
        name: `${item.title} (ص ${r.from}–${r.to})`,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <div className="font-bold">{item.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          {item.label && <span>{item.label}</span>}
          {total != null && <span>{total} صفحة</span>}
          <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-brand-600 underline dark:text-brand-300">
            افتح الملف في موقع الوزارة ↗
          </a>
        </div>
      </div>
      {loading ? (
        <Loading text="جاري تحميل الملف من مكتبة الوزارة… (أول مرة ممكن ياخذ دقيقة)" />
      ) : total != null ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">من صفحة</span>
              <Input type="number" inputMode="numeric" min={1} max={total} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="من صفحة" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">إلى صفحة</span>
              <Input type="number" inputMode="numeric" min={1} max={total} value={to} onChange={(e) => setTo(e.target.value)} aria-label="إلى صفحة" />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            أرقام الصفحات حسب ملف PDF (ممكن تختلف شوي عن الرقم المطبوع في الكتاب). الحد {max} صفحة في المرة.
          </p>
          {!valid && <p className="text-sm text-red-600">اختر صفحات بين 1 و {total}، وبحد أقصى {max} صفحة.</p>}
        </>
      ) : null}
      {error && <ErrorBox message={error} />}
      <div className="flex justify-between gap-2">
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            → رجوع
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={add} disabled={!valid || busy}>
          {busy ? <Spinner /> : "📎"} أضف الصفحات
        </Button>
      </div>
    </div>
  );
}

/** قائمة ملفات الوزارة للصف والمادة الحالية */
export function MoeItemsStep({ onPick }: { onPick: (item: MoeItem) => void }) {
  const app = useApp();
  const ctx = app?.ctx;
  const teacher = ctx?.role === "teacher";
  const [term, setTerm] = useState<1 | 2>(currentTerm());
  const [lib, setLib] = useState<"student" | "teacher">(teacher ? "teacher" : "student");
  const [cat, setCat] = useState<MoeCatalog | null>(null);
  const [subj, setSubj] = useState<string>("auto");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ctx) return;
    let alive = true;
    setCat(null);
    setError("");
    moeCatalog(ctx.grade, term, lib === "teacher", ctx.subject)
      .then((c) => alive && setCat(c))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [ctx?.grade, ctx?.subject, term, lib]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = useMemo(() => {
    if (!cat) return new Set<number>();
    if (subj === "all") return new Set(cat.subjects.map((s) => s.id));
    if (subj !== "auto") return new Set([Number(subj)]);
    return new Set(cat.subjects.filter((s) => s.match).map((s) => s.id));
  }, [cat, subj]);
  const items = cat ? [...cat.books, ...cat.exams].filter((i) => ids.has(i.subjectId)) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Segmented label="الفصل" value={term} onChange={setTerm} options={[{ value: 1, label: "الفصل الأول" }, { value: 2, label: "الفصل الثاني" }]} />
        {teacher && (
          <Segmented
            label="المكتبة"
            value={lib}
            onChange={setLib}
            options={[
              { value: "student", label: "كتب الطالب" },
              { value: "teacher", label: "مكتبة المعلم" },
            ]}
          />
        )}
      </div>
      {cat && (
        <Select value={subj} onChange={(e) => setSubj(e.target.value)} aria-label="المادة في مكتبة الوزارة">
          <option value="auto">المادة الحالية ({cat.subjects.filter((s) => s.match).map((s) => s.name).join("، ") || "ما فيه تطابق"})</option>
          <option value="all">كل المواد</option>
          {cat.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      {error && <ErrorBox message={error} />}
      {!cat && !error && <Loading text="جاري جلب فهرس مكتبة الوزارة…" />}
      {cat && items.length === 0 && <p className="py-4 text-center text-sm text-slate-500">ما فيه ملفات لهذي المادة والفصل. جرّب «كل المواد» أو الفصل الثاني.</p>}
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={`${i.kind}-${i.id}`}>
            <button
              type="button"
              onClick={() => onPick(i)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-start hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-900/20"
            >
              <span className="text-xl" aria-hidden>
                {i.kind === "book" ? (i.label === "دليل المعلم" ? "🧑‍🏫" : i.label ? "🗂️" : "📘") : "📝"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{i.title}</span>
                <span className="block text-xs text-slate-500">
                  {cat?.subjects.find((s) => s.id === i.subjectId)?.name}
                  {i.label && ` · ${i.label}`}
                </span>
              </span>
              <span className="text-slate-400">◂</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** نافذة: اختر كتاب ← اختر الصفحات ← تنضاف كمرفق */
export function LibraryPickerDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (img: PickedImage) => void }) {
  const [item, setItem] = useState<MoeItem | null>(null);
  return (
    <Dialog title="📚 صفحات من مكتبة وزارة التربية" onClose={onClose}>
      {item ? (
        <PagesStep
          item={item}
          onBack={() => setItem(null)}
          onAdd={(img) => {
            onAdd(img);
            onClose();
          }}
        />
      ) : (
        <MoeItemsStep onPick={setItem} />
      )}
    </Dialog>
  );
}

/** يعرض الصفحات الجاهزة من المكتبة داخل أي أداة، بضغطة تنضاف */
export function InboxChips({ onTake }: { onTake: (img: PickedImage) => void }) {
  const app = useApp();
  if (!app?.inbox.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 p-2 text-sm dark:bg-brand-900/20">
      <span className="text-brand-800 dark:text-brand-200">📚 جاهز من المكتبة:</span>
      {app.inbox.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => {
            const got = app.takeFromInbox(i.id);
            if (got) onTake(got);
          }}
          className={cx("max-w-full truncate rounded-full border border-brand-300 bg-white px-3 py-1 font-bold text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-slate-900 dark:text-brand-200")}
        >
          ➕ {i.name}
        </button>
      ))}
    </div>
  );
}
