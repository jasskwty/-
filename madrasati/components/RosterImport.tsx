"use client";
import { useState } from "react";
import { GRADES, type StudyContext } from "@/lib/constants";
import { toPayload, type PickedImage } from "@/lib/client/image";
import { postJson } from "@/lib/client/stream";
import { ImageInput } from "./ImageInput";
import { Dialog } from "./LibraryPicker";
import { Button, ErrorBox, Input, Loading, Select, TextArea, cx } from "./ui";

export interface RosterClass {
  name: string;
  grade: string;
  students: string[];
  unclear: string[];
}

/** فصل جاهز للإضافة بعد مراجعة المعلم */
export interface RosterImportItem {
  target: "new" | string; // "new" أو رقم فصل موجود
  name: string;
  grade: string;
  students: string[];
}

interface Draft {
  include: boolean;
  target: string;
  name: string;
  grade: string;
  text: string; // اسم في كل سطر
  unclear: string[];
}

const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * 📷 تصوير الكشف: المساعد يقرأ الأسماء ← المعلم يراجع ويعدّل ← تنضاف للسجل.
 */
export function RosterImport({
  ctx,
  existing,
  onClose,
  onImport,
}: {
  ctx: StudyContext;
  existing: { id: string; name: string }[];
  onClose: () => void;
  onImport: (items: RosterImportItem[]) => void;
}) {
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  async function read() {
    setLoading(true);
    setError("");
    try {
      const r = await postJson<{ classes: RosterClass[]; warnings: string }>("/api/json", {
        grade: ctx.grade,
        subject: ctx.subject,
        role: "teacher",
        tool: "roster",
        images: toPayload(files),
      });
      setWarnings(r.warnings);
      setDrafts(
        r.classes.map((c) => {
          // إذا فيه فصل بنفس الاسم، نقترح الدمج معه
          const same = existing.find((e) => e.name.replace(/\s+/g, "") === c.name.replace(/\s+/g, ""));
          return {
            include: true,
            target: same ? same.id : "new",
            name: c.name,
            grade: c.grade || ctx.grade,
            text: c.students.join("\n"),
            unclear: c.unclear,
          };
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const set = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds!.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const chosen = drafts?.filter((d) => d.include && lines(d.text).length) ?? [];
  const totalStudents = chosen.reduce((n, d) => n + lines(d.text).length, 0);

  return (
    <Dialog title="📷 صوّر الكشف" onClose={onClose}>
      {!drafts ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            صوّر كشف الفصل (أو أكثر من كشف لأكثر من فصل)، والمساعد يقرأ الأسماء ويوزعها على الفصول. بعدها تراجعها وتعدّلها قبل الإضافة.
          </p>
          <ImageInput images={files} onChange={setFiles} allowPdf noLibrary max={8} label="صوّر أو ارفع الكشوف" />
          <ul className="list-disc space-y-1 ps-5 text-xs text-slate-500 dark:text-slate-400">
            <li>صوّر الكشف كامل بإضاءة جيدة، وكل صفحة بصورة.</li>
            <li>تقدر ترفع لين ٨ صور أو ملفات PDF، لأكثر من فصل مرة وحدة.</li>
          </ul>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <input type="checkbox" className="mt-1 size-4 accent-brand-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              🔒 أوافق على إرسال صورة الكشف لخدمة Claude لقراءة الأسماء فقط. المساعد ما ينقل الرقم المدني أو الهواتف أو أي معلومة ثانية، والأسماء تنحفظ في جهازي بس.
              <span className="block text-xs opacity-80">نصيحة: إذا تقدر، غطّ عمود الرقم المدني قبل التصوير.</span>
            </span>
          </label>
          {error && <ErrorBox message={error} />}
          {loading ? (
            <Loading text="المساعد يقرأ الكشف… (ممكن ياخذ دقيقة)" />
          ) : (
            <Button onClick={read} disabled={!files.length || !consent} className="w-full">
              🔍 اقرأ الكشف
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">
            لقينا <b>{drafts.length}</b> {drafts.length === 1 ? "فصل" : "فصول"}. راجع الأسماء وعدّلها (اسم في كل سطر)، واختر وين تنضاف.
          </p>
          {warnings && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">⚠️ {warnings}</p>}
          {drafts.map((d, i) => (
            <div key={i} className={cx("space-y-2 rounded-2xl border p-3", d.include ? "border-brand-200 dark:border-brand-900" : "border-slate-200 opacity-60 dark:border-slate-800")}>
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" className="size-4 accent-brand-600" checked={d.include} onChange={(e) => set(i, { include: e.target.checked })} />
                الفصل {i + 1} · {lines(d.text).length} طالب
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Select value={d.target} onChange={(e) => set(i, { target: e.target.value })} aria-label={`وين ينضاف الفصل ${i + 1}`}>
                  <option value="new">➕ فصل جديد</option>
                  {existing.map((c) => (
                    <option key={c.id} value={c.id}>
                      دمج مع: {c.name}
                    </option>
                  ))}
                </Select>
                {d.target === "new" && (
                  <>
                    <Input value={d.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={`اسم الفصل ${i + 1}`} maxLength={40} />
                    <Select value={d.grade} onChange={(e) => set(i, { grade: e.target.value })} aria-label={`صف الفصل ${i + 1}`}>
                      {GRADES.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
              </div>
              <TextArea rows={Math.min(10, Math.max(4, lines(d.text).length))} value={d.text} onChange={(e) => set(i, { text: e.target.value })} aria-label={`أسماء الفصل ${i + 1}`} />
              {d.unclear.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">🔎 تأكد من هذي الأسماء (ما كانت واضحة): {d.unclear.join("، ")}</p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setDrafts(null)}>
              → صوّر من جديد
            </Button>
            <Button
              disabled={!chosen.length}
              onClick={() => {
                onImport(chosen.map((d) => ({ target: d.target, name: d.name.trim() || "فصل جديد", grade: d.grade, students: lines(d.text) })));
                onClose();
              }}
            >
              ✅ أضف {totalStudents} طالب في {chosen.length} {chosen.length === 1 ? "فصل" : "فصول"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
