"use client";
import { useState } from "react";
import { gradeLabel, subjectLabel, type StudyContext } from "@/lib/constants";
import { streamPost } from "@/lib/client/stream";
import { toPayload, type PickedImage } from "@/lib/client/image";
import { clearTeacherData } from "@/lib/client/storage";
import { ImageInput } from "./ImageInput";
import { Button, ErrorBox, Spinner, TextArea, cx } from "./ui";

const MAX_REFERENCE = 30000;

/** 📚 مرجع المنهج: ينرسل مع كل طلب في وضع المعلم لهذا الصف والمادة */
export function ReferencePanel({
  ctx,
  value,
  onChange,
}: {
  ctx: StudyContext;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const has = value.trim().length > 0;

  async function extract() {
    setBusy(true);
    setError("");
    try {
      const prev = value.trim();
      const text = await streamPost(
        "/api/generate",
        { ...ctx, reference: "", tool: "extractReference", images: toPayload(files) },
        (t) => onChange((prev ? prev + "\n\n" : "") + t),
      );
      onChange(((prev ? prev + "\n\n" : "") + text).slice(0, MAX_REFERENCE));
      setFiles([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx("rounded-2xl border", has ? "border-emerald-200 dark:border-emerald-900" : "border-slate-200 dark:border-slate-800", "bg-white dark:bg-slate-900")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm"
      >
        <span className="font-bold">📚 مرجع المنهج</span>
        <span className="text-slate-500 dark:text-slate-400">
          {gradeLabel(ctx.grade)} · {subjectLabel(ctx.subject)}
        </span>
        <span
          className={cx(
            "ms-auto rounded-full px-2 py-0.5 text-xs font-bold",
            has ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800",
          )}
        >
          {has ? `✓ مضاف (${value.length.toLocaleString("en")} حرف)` : "غير مضاف"}
        </span>
        <span className={cx("transition-transform", open && "-rotate-90")}>◂</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            الصق أهداف ومعايير المنهج الرسمي، أو قائمة الدروس، أو ملاحظاتك عن أسلوبك. المساعد يلتزم فيه ويربط التحضير والأسئلة بأهدافه ورموزه، في كل أدوات المعلم لهذا الصف والمادة.
          </p>
          <TextArea
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, MAX_REFERENCE))}
            rows={8}
            placeholder={"مثال:\nالوحدة الأولى: الأعداد النسبية\n- الهدف ١-١: أن يقارن الطالب بين الأعداد النسبية…"}
            aria-label="مرجع المنهج"
            readOnly={busy}
            className={busy ? "opacity-70" : undefined}
          />
          {busy && (
            <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
              <Spinner className="text-brand-500" /> جاري استخراج الأهداف والمعايير من الملف…
            </p>
          )}
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="mb-2 text-sm font-bold">📄 أو استخرجه من ملف المنهج أو دليل المعلم</div>
            <ImageInput images={files} onChange={setFiles} allowPdf label="ارفع PDF أو صور الصفحات" />
            <Button size="sm" className="mt-2" onClick={extract} disabled={!files.length || busy}>
              {busy ? <Spinner /> : "✨"} استخرج الأهداف والمعايير
            </Button>
            {error && (
              <div className="mt-2">
                <ErrorBox message={error} />
              </div>
            )}
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">ينحفظ في هذا المتصفح. راجع المستخرج وعدّله قبل الاعتماد عليه.</span>
            {has && (
              <Button variant="danger" size="sm" onClick={() => confirm("تمسح مرجع المنهج لهذا الصف والمادة؟") && onChange("")}>
                مسح
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 🔒 الخصوصية والتحكم */
export function PrivacyPanel({ teacherTools }: { teacherTools: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm">
        <span className="font-bold">🔒 الخصوصية والتحكم</span>
        <span className="text-slate-500 dark:text-slate-400">المساعد يقترح ← أنت تراجع وتقرر ← الطالب يتعلم</span>
        <span className={cx("ms-auto transition-transform", open && "-rotate-90")}>◂</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-4 text-sm dark:border-slate-800">
          <ul className="list-disc space-y-1.5 ps-5 text-slate-700 dark:text-slate-300">
            <li>
              <b>بياناتك في جهازك:</b> سجل الطلاب، والدرجات، والمتابعات، والنتائج كلها محفوظة في هذا المتصفح فقط، وما فيه قاعدة بيانات أو حسابات.
            </li>
            <li>
              <b>الأسماء ما تطلع:</b> في سجل الطلاب والرسائل، الأسماء تتبدل برموز (S1، S2، [اسم الطالب]) قبل الإرسال، وترجع في العرض عندك فقط.
            </li>
            <li>
              <b>انتبه للمرفقات والنصوص الحرة:</b> الصور وملفات PDF والنصوص اللي تكتبها تنرسل كما هي لخدمة Claude عشان تتم المعالجة. لا ترفع أوراق فيها أسماء أو أرقام مدنية أو معلومات صحية، وغطّها قبل التصوير.
            </li>
            <li>
              <b>كل ناتج مسودة:</b> أي نتيجة تطلع «مسودة مقترحة» إلى أن تراجعها وتعدّلها وتعتمدها. الدرجات والقرارات التربوية قرارك أنت.
            </li>
            <li>
              <b>المفتاح محمي:</b> مفتاح Claude موجود في السيرفر فقط، وما يوصل للمتصفح.
            </li>
          </ul>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (!confirm("تبي تحذف كل بيانات وضع المعلم من هذا الجهاز؟ (السجلات، الفصول، المتابعات، النتائج، المرجع)")) return;
              clearTeacherData(teacherTools);
              location.reload();
            }}
          >
            🗑️ حذف كل بيانات المعلم من هذا الجهاز
          </Button>
        </div>
      )}
    </div>
  );
}
