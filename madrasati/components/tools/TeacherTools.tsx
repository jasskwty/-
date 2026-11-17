"use client";
import { useState } from "react";
import { subjectLabel, type StudyContext } from "@/lib/constants";
import { toPayload, type PickedImage } from "@/lib/client/image";
import { useStored } from "@/lib/client/storage";
import { hideNames } from "@/lib/client/privacy";
import { ImageInput } from "../ImageInput";
import { TextTool } from "../TextTool";
import { Button, Card, EmptyHint, Field, Input, Segmented, TextArea, Toggle, cx } from "../ui";

const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s);

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">{children}</span>;
}

/** رفع صفحات من الكتاب المدرسي أو دليل المعلم كمصدر */
function SourcePages({ files, onChange }: { files: PickedImage[]; onChange: (f: PickedImage[]) => void }) {
  return (
    <div>
      <Label>صفحات من الكتاب أو دليل المعلم (اختياري)</Label>
      <ImageInput images={files} onChange={onChange} allowPdf label="ارفع صفحات (صور أو PDF)" />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">المساعد يعتمد عليها كمصدر أساسي بدل المعلومات العامة.</p>
    </div>
  );
}

// ===== 📋 تحضير درس =====
export function LessonPlanTool({ ctx }: { ctx: StudyContext }) {
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useStored("teacher:minutes", 45);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<PickedImage[]>([]);
  return (
    <TextTool
      tool="lessonPlan"
      ctx={ctx}
      empty={<EmptyHint icon="📋" title="تحضير درس جاهز" text="أهداف، وسائل، سير الحصة بالدقائق، نشاط تعلم نشط، تقويم، فروق فردية، وواجب." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!topic.trim() || busy) return;
              run({
                body: { input: topic, minutes, notes, images: toPayload(files) },
                label: topic,
                request: `حضّر لي درس: ${topic} (${minutes} دقيقة)`,
              });
            }}
          >
            <Field label="عنوان الدرس">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={`مثال: درس من مادة ${subjectLabel(ctx.subject)}`} maxLength={300} />
            </Field>
            <div>
              <Label>زمن الحصة</Label>
              <Segmented label="زمن الحصة" value={minutes} onChange={setMinutes} options={[35, 40, 45, 50, 90].map((n) => ({ value: n, label: `${n} د` }))} />
            </div>
            <Field label="ملاحظات (اختياري)" hint="مثلاً: عدد الطلاب، الأجهزة المتوفرة، مستوى الصف، أو هدف تبي تركز عليه">
              <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1500} />
            </Field>
            <SourcePages files={files} onChange={setFiles} />
            <Button type="submit" disabled={!topic.trim() || busy}>
              📋 حضّر الدرس
            </Button>
          </form>
        </Card>
      )}
    />
  );
}

// ===== 📄 ورقة عمل / اختبار =====
const Q_TYPES = [
  { id: "mcq", label: "اختيار من متعدد" },
  { id: "tf", label: "صح وخطأ" },
  { id: "fill", label: "أكمل" },
  { id: "short", label: "علّل / إجابة قصيرة" },
  { id: "match", label: "توصيل" },
  { id: "problem", label: "مسائل" },
  { id: "essay", label: "مقالي" },
  { id: "hots", label: "تفكير ناقد" },
];
const KINDS = [
  { value: "worksheet", label: "ورقة عمل" },
  { value: "quiz", label: "اختبار قصير" },
  { value: "exam", label: "اختبار شامل" },
  { value: "homework", label: "واجب منزلي" },
  { value: "bank", label: "🏦 بنك أسئلة" },
];

export function WorksheetTool({ ctx }: { ctx: StudyContext }) {
  const [kind, setKind] = useState("worksheet");
  const [topic, setTopic] = useState("");
  const [types, setTypes] = useStored<string[]>("teacher:qtypes", ["mcq", "tf", "fill"]);
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState("متنوع");
  const [total, setTotal] = useState("");
  const [answerKey, setAnswerKey] = useState(true);
  const [objectives, setObjectives] = useState("");
  const [files, setFiles] = useState<PickedImage[]>([]);
  const bank = kind === "bank";
  const can = topic.trim() && types.length > 0;
  return (
    <TextTool
      tool="worksheet"
      ctx={ctx}
      empty={<EmptyHint icon="📄" title="ورقة جاهزة للطباعة" text="اختر النوع والموضوع وأنواع الأسئلة، وبعدين اطبعها بزر «طباعة» تحت النتيجة." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!can || busy) return;
              const kindLabel = KINDS.find((k) => k.value === kind)!.label;
              run({
                body: { input: topic, kind, types, count, level, total: Number(total) || 0, answerKey, objectives, images: toPayload(files) },
                label: `${kindLabel}: ${topic}`,
                request: `${kindLabel} في: ${topic}`,
              });
            }}
          >
            <Segmented label="النوع" value={kind} onChange={setKind} options={KINDS} />
            <Field label="الموضوع أو الدروس المشمولة">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: الوحدة الثانية — الكسور والعمليات عليها" maxLength={500} />
            </Field>
            {bank && (
              <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
                🏦 بنك الأسئلة يطلع جدول: كل سؤال مع نوعه ومستوى التفكير (بلوم) والهدف المرتبط والإجابة. يرتبط بأهداف «مرجع المنهج» إذا أضفته.
              </p>
            )}
            <Field label="الأهداف أو المعايير المرتبطة (اختياري)">
              <Input value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="مثال: أن يجمع الطالب كسرين مختلفي المقام" maxLength={1500} />
            </Field>
            <div>
              <Label>أنواع الأسئلة</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="أنواع الأسئلة">
                {Q_TYPES.map((t) => {
                  const on = types.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTypes((xs) => (on ? xs.filter((x) => x !== t.id) : [...xs, t.id]))}
                      className={cx(
                        "rounded-full border px-3 py-1.5 text-sm font-bold transition-colors",
                        on
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                          : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300",
                      )}
                    >
                      {on ? "✓ " : ""}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`عدد الأسئلة: ${count}`}>
                <input type="range" min={5} max={40} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-3 w-full accent-brand-600" />
              </Field>
              <div>
                <Label>المستوى</Label>
                <Segmented label="المستوى" value={level} onChange={setLevel} options={["سهل", "متوسط", "صعب", "متنوع"].map((l) => ({ value: l, label: l }))} />
              </div>
              <Field label="الدرجة الكلية (اختياري)">
                <Input type="number" inputMode="numeric" min={0} max={100} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="مثال: 20" />
              </Field>
            </div>
            <SourcePages files={files} onChange={setFiles} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {bank ? (
                <span className="text-sm text-slate-500">الإجابات داخل الجدول</span>
              ) : (
                <Toggle checked={answerKey} onChange={setAnswerKey} label="🔑 مفتاح الإجابة" hint="يطلع في آخر الورقة" />
              )}
              <Button type="submit" disabled={!can || busy}>
                📄 جهّز الورقة
              </Button>
            </div>
          </form>
        </Card>
      )}
    />
  );
}

// ===== ✅ تصحيح إجابات =====
export function GradeTool({ ctx }: { ctx: StudyContext }) {
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState("");
  const [answer, setAnswer] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [total, setTotal] = useState("10");
  const can = answer.trim() || images.length > 0;
  return (
    <TextTool
      tool="grade"
      ctx={ctx}
      empty={<EmptyHint icon="✅" title="صحّح ورقة طالب" text="الصق إجابة الطالب أو صوّر ورقته، ويطلع لك جدول درجات، والأخطاء، وملاحظة جاهزة للطالب." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!can || busy) return;
              run({
                body: { question, modelAnswer: model, input: answer, images: toPayload(images), total: Number(total) || 10 },
                label: question.trim() ? `تصحيح: ${short(question.trim(), 50)}` : "تصحيح ورقة طالب",
                request: `صحّح إجابة الطالب${question ? ` على: ${short(question, 1500)}` : ""}`,
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="السؤال أو الأسئلة (اختياري)">
                <TextArea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={8000} />
              </Field>
              <Field label="نموذج الإجابة (اختياري)">
                <TextArea rows={3} value={model} onChange={(e) => setModel(e.target.value)} maxLength={8000} />
              </Field>
            </div>
            <Field label="إجابة الطالب">
              <TextArea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="الصق إجابة الطالب هنا، أو ارفع صورة الورقة…" maxLength={12000} />
            </Field>
            <ImageInput images={images} onChange={setImages} allowPdf />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <Field label="الدرجة الكلية" className="sm:w-40">
                <Input type="number" inputMode="numeric" min={1} max={100} value={total} onChange={(e) => setTotal(e.target.value)} />
              </Field>
              <Button type="submit" disabled={!can || busy}>
                ✅ صحّح
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              التصحيح يستخدم الموديل الأقوى للدقة. راجع الدرجة قبل اعتمادها، ولا ترفع معلومات شخصية عن الطالب.
            </p>
          </form>
        </Card>
      )}
    />
  );
}

// ===== 📏 سلّم تقدير =====
export function RubricTool({ ctx }: { ctx: StudyContext }) {
  const [task, setTask] = useState("");
  const [levels, setLevels] = useState(4);
  const [total, setTotal] = useState("");
  return (
    <TextTool
      tool="rubric"
      ctx={ctx}
      empty={<EmptyHint icon="📏" title="سلّم تقدير واضح" text="اكتب وصف المشروع أو المهمة، ويطلع لك جدول معايير بمستويات أداء، ونسخة مختصرة للطلاب." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!task.trim() || busy) return;
              run({ body: { input: task, levels, total: Number(total) || 0 }, label: `سلّم تقدير: ${short(task.trim(), 50)}`, request: `سلّم تقدير لمهمة: ${task}` });
            }}
          >
            <Field label="وصف المهمة أو المشروع">
              <TextArea rows={3} value={task} onChange={(e) => setTask(e.target.value)} placeholder="مثال: مشروع جماعي — نموذج للمجموعة الشمسية مع عرض شفهي ٥ دقائق" maxLength={3000} />
            </Field>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div>
                <Label>مستويات الأداء</Label>
                <Segmented label="مستويات الأداء" value={levels} onChange={setLevels} options={[3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
              </div>
              <Field label="الدرجة الكلية (اختياري)" className="w-40">
                <Input type="number" inputMode="numeric" min={0} max={100} value={total} onChange={(e) => setTotal(e.target.value)} />
              </Field>
              <Button type="submit" disabled={!task.trim() || busy} className="ms-auto">
                📏 جهّز السلّم
              </Button>
            </div>
          </form>
        </Card>
      )}
    />
  );
}

// ===== 🧩 أنشطة ووسائل وتجارب =====
const ACTIVITY_KINDS = [
  { value: "differentiated", label: "🎚️ متمايزة" },
  { value: "interactive", label: "🎲 تفاعلية وألعاب" },
  { value: "experiment", label: "🧪 تجربة عملية" },
  { value: "aids", label: "🖼️ وسائل تعليمية" },
];

export function DifferentiateTool({ ctx }: { ctx: StudyContext }) {
  const [kind, setKind] = useState("differentiated");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [mode, setMode] = useState<"groups" | "individual">("groups");
  return (
    <TextTool
      tool="differentiate"
      ctx={ctx}
      empty={<EmptyHint icon="🧩" title="أنشطة ووسائل وتجارب" text="أنشطة بثلاث مستويات، أو ألعاب تفاعلية، أو تجربة عملية آمنة، أو وسائل تعليمية للدرس." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!topic.trim() || busy) return;
              const kindLabel = ACTIVITY_KINDS.find((k) => k.value === kind)!.label.slice(3);
              run({ body: { input: topic, minutes, mode, kind }, label: `${kindLabel}: ${topic}`, request: `${kindLabel} في: ${topic}` });
            }}
          >
            <Segmented label="نوع النشاط" value={kind} onChange={setKind} options={ACTIVITY_KINDS} />
            <Field label="الهدف أو الموضوع">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: أن يميّز الطالب بين الفاعل ونائب الفاعل" maxLength={500} />
            </Field>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div>
                <Label>الزمن</Label>
                <Segmented label="الزمن" value={minutes} onChange={setMinutes} options={[10, 15, 20, 30, 45].map((n) => ({ value: n, label: `${n} د` }))} />
              </div>
              <div>
                <Label>طريقة العمل</Label>
                <Segmented
                  label="طريقة العمل"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "groups", label: "مجموعات" },
                    { value: "individual", label: "فردي" },
                  ]}
                />
              </div>
              <Button type="submit" disabled={!topic.trim() || busy} className="ms-auto">
                🧩 اقترح
              </Button>
            </div>
          </form>
        </Card>
      )}
    />
  );
}

// ===== 🪜 تبسيط المحتوى لمستويات مختلفة =====
const SIMPLIFY_LEVELS = [
  { id: "support", label: "🟢 مبسط جداً (دعم)" },
  { id: "grade", label: "🔵 مستوى الصف" },
  { id: "advanced", label: "🟣 متقدم (إثراء)" },
  { id: "l2", label: "🌐 لغير الناطقين بالعربية" },
];

export function SimplifyTool({ ctx }: { ctx: StudyContext }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [levels, setLevels] = useStored<string[]>("teacher:simplify:levels", ["support", "grade", "advanced"]);
  const [vocab, setVocab] = useState(true);
  const [questions, setQuestions] = useState(true);
  const can = (text.trim() || files.length > 0) && levels.length > 0;
  return (
    <TextTool
      tool="simplify"
      ctx={ctx}
      empty={<EmptyHint icon="🪜" title="نفس المحتوى لكل المستويات" text="الصق نص من الكتاب أو ارفع صفحاته، ويطلع لك بعدة مستويات قراءة، مع المفردات وأسئلة فهم." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!can || busy) return;
              run({
                body: { input: text, images: toPayload(files), levels, vocab, questions },
                label: text.trim() ? `تبسيط: ${short(text.trim(), 50)}` : "تبسيط صفحات مرفقة",
                request: `بسّط هذا المحتوى لمستويات مختلفة: ${short(text, 3000)}`,
              });
            }}
          >
            <Field label="النص الأصلي">
              <TextArea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="الصق النص هنا، أو ارفع الصفحات تحت…" maxLength={15000} />
            </Field>
            <ImageInput images={files} onChange={setFiles} allowPdf />
            <div>
              <Label>المستويات المطلوبة</Label>
              <Chips options={SIMPLIFY_LEVELS} value={levels} onChange={setLevels} />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Toggle checked={vocab} onChange={setVocab} label="📖 جدول المفردات" />
              <Toggle checked={questions} onChange={setQuestions} label="❓ أسئلة فهم لكل مستوى" />
              <Button type="submit" disabled={!can || busy} className="sm:ms-auto">
                🪜 بسّط المحتوى
              </Button>
            </div>
          </form>
        </Card>
      )}
    />
  );
}

/** اختيار متعدد على شكل أزرار */
function Chips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={cx(
              "rounded-full border px-3 py-1.5 text-sm font-bold transition-colors",
              on
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300",
            )}
          >
            {on ? "✓ " : ""}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ===== 🤝 دعم الاحتياجات والسقالات =====
const NEEDS = [
  { value: "dyslexia", label: "صعوبات القراءة" },
  { value: "writing", label: "صعوبات الكتابة" },
  { value: "dyscalculia", label: "صعوبات الحساب" },
  { value: "adhd", label: "تشتت الانتباه وفرط الحركة" },
  { value: "autism", label: "طيف التوحد" },
  { value: "slow", label: "بطء التعلم" },
  { value: "sensory", label: "ضعف السمع أو البصر" },
  { value: "anxiety", label: "قلق الاختبارات / ضعف الثقة" },
  { value: "gifted", label: "الموهوبين والمتفوقين" },
];

export function ScaffoldTool({ ctx }: { ctx: StudyContext }) {
  const [need, setNeed] = useState("dyslexia");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <TextTool
      tool="scaffold"
      ctx={ctx}
      empty={<EmptyHint icon="🤝" title="سقالات وتكييفات عملية" text="اختر نوع الاحتياج والدرس، ويطلع لك سقالات تعليمية، وتكييفات في المهمة والتقييم، واستراتيجيات للصف." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!topic.trim() || busy) return;
              const needLabel = NEEDS.find((n) => n.value === need)!.label;
              run({ body: { need, input: topic, notes }, label: `${needLabel}: ${topic}`, request: `دعم طالب (${needLabel}) في: ${topic}` });
            }}
          >
            <div>
              <Label>نوع الاحتياج</Label>
              <Segmented label="نوع الاحتياج" value={need} onChange={setNeed} options={NEEDS} />
            </div>
            <Field label="الدرس أو المهمة">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: قراءة نص «الماء سر الحياة» والإجابة عن أسئلته" maxLength={500} />
            </Field>
            <Field label="وصف مختصر للحالة (اختياري، بدون أسماء)" hint="مثال: يقرأ ببطء ويتعب من النصوص الطويلة، بس فهمه الشفهي ممتاز">
              <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1500} />
            </Field>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">هذي مقترحات تربوية، مو تشخيص. نسّق مع الأخصائي في المدرسة.</p>
              <Button type="submit" disabled={!topic.trim() || busy}>
                🤝 اقترح الدعم
              </Button>
            </div>
          </form>
        </Card>
      )}
    />
  );
}

// ===== ✉️ رسائل وملاحظات =====
const COMMENT_KINDS = [
  { value: "parent", label: "رسالة لولي الأمر" },
  { value: "report", label: "ملاحظة للشهادة" },
  { value: "praise", label: "تعزيز للطالب" },
  { value: "warning", label: "تنبيه لولي الأمر" },
  { value: "periodic", label: "تقرير دوري" },
];

export function CommentsTool({ ctx }: { ctx: StudyContext }) {
  const [kind, setKind] = useState("parent");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <TextTool
      tool="comments"
      ctx={ctx}
      empty={<EmptyHint icon="✉️" title="صياغة لبقة بثواني" text="اكتب ملاحظاتك عن الطالب باختصار، ويطلع لك ٣ صيغ جاهزة للنسخ: رسمية، ودية، ومختصرة." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!notes.trim() || busy) return;
              const kindLabel = COMMENT_KINDS.find((k) => k.value === kind)!.label;
              // الاسم يبقى في جهازك: نرسل [اسم الطالب] ونعوّضه في العرض
              const aliases = name.trim() ? { "[اسم الطالب]": name.trim() } : undefined;
              const safeNotes = aliases ? hideNames(notes, aliases) : notes;
              run({
                body: { kind, input: safeNotes },
                label: `${kindLabel}${name ? `: ${name}` : ""}`,
                request: `${kindLabel} عن [اسم الطالب]. ملاحظاتي: ${safeNotes}`,
                aliases,
              });
            }}
          >
            <Segmented label="النوع" value={kind} onChange={setKind} options={COMMENT_KINDS} />
            <Field label="اسم الطالب (اختياري)" hint="🔒 الاسم ما يُرسل للمساعد: يُستبدل بـ [اسم الطالب] ويرجع في العرض عندك بس">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <Field label="ملاحظاتك عن الطالب" hint="باختصار: نقاط القوة، اللي يحتاج تحسين، وأي موقف محدد. لا تكتب معلومات حساسة.">
              <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: متفاعل في الحصة، بس يتأخر في تسليم الواجبات، وتحسن مستواه في آخر اختبار" maxLength={3000} />
            </Field>
            <Button type="submit" disabled={!notes.trim() || busy}>
              ✉️ اكتب الصيغ
            </Button>
          </form>
        </Card>
      )}
    />
  );
}
