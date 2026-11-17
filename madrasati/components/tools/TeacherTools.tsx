"use client";
import { useState } from "react";
import { subjectLabel, type StudyContext } from "@/lib/constants";
import { toPayload, type PickedImage } from "@/lib/client/image";
import { useStored } from "@/lib/client/storage";
import { ImageInput } from "../ImageInput";
import { TextTool } from "../TextTool";
import { Button, Card, EmptyHint, Field, Input, Segmented, TextArea, Toggle, cx } from "../ui";

const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s);

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">{children}</span>;
}

// ===== 📋 تحضير درس =====
export function LessonPlanTool({ ctx }: { ctx: StudyContext }) {
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useStored("teacher:minutes", 45);
  const [notes, setNotes] = useState("");
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
                body: { input: topic, minutes, notes },
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
];
const KINDS = [
  { value: "worksheet", label: "ورقة عمل" },
  { value: "quiz", label: "اختبار قصير" },
  { value: "exam", label: "اختبار شامل" },
  { value: "homework", label: "واجب منزلي" },
];

export function WorksheetTool({ ctx }: { ctx: StudyContext }) {
  const [kind, setKind] = useState("worksheet");
  const [topic, setTopic] = useState("");
  const [types, setTypes] = useStored<string[]>("teacher:qtypes", ["mcq", "tf", "fill"]);
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState("متنوع");
  const [total, setTotal] = useState("");
  const [answerKey, setAnswerKey] = useState(true);
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
                body: { input: topic, kind, types, count, level, total: Number(total) || 0, answerKey },
                label: `${kindLabel}: ${topic}`,
                request: `${kindLabel} في: ${topic}`,
              });
            }}
          >
            <Segmented label="النوع" value={kind} onChange={setKind} options={KINDS} />
            <Field label="الموضوع أو الدروس المشمولة">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: الوحدة الثانية — الكسور والعمليات عليها" maxLength={500} />
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Toggle checked={answerKey} onChange={setAnswerKey} label="🔑 مفتاح الإجابة" hint="يطلع في آخر الورقة" />
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
            <ImageInput images={images} onChange={setImages} />
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

// ===== 🧩 أنشطة متمايزة =====
export function DifferentiateTool({ ctx }: { ctx: StudyContext }) {
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [mode, setMode] = useState<"groups" | "individual">("groups");
  return (
    <TextTool
      tool="differentiate"
      ctx={ctx}
      empty={<EmptyHint icon="🧩" title="نشاط واحد لكل المستويات" text="أنشطة لنفس الهدف بثلاث مستويات: دعم، أساسي، وإثراء، مع طريقة إدارتها في الصف." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!topic.trim() || busy) return;
              run({ body: { input: topic, minutes, mode }, label: topic, request: `أنشطة متمايزة في: ${topic}` });
            }}
          >
            <Field label="الهدف أو الموضوع">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: أن يميّز الطالب بين الفاعل ونائب الفاعل" maxLength={500} />
            </Field>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div>
                <Label>زمن النشاط</Label>
                <Segmented label="زمن النشاط" value={minutes} onChange={setMinutes} options={[10, 15, 20, 30].map((n) => ({ value: n, label: `${n} د` }))} />
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
                🧩 جهّز الأنشطة
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
              run({
                body: { kind, studentName: name, input: notes },
                label: `${kindLabel}${name ? `: ${name}` : ""}`,
                request: `${kindLabel} عن طالب. ملاحظاتي: ${notes}`,
              });
            }}
          >
            <Segmented label="النوع" value={kind} onChange={setKind} options={COMMENT_KINDS} />
            <Field label="اسم الطالب (اختياري)" hint="إذا تركته فاضي، بيطلع مكانه [اسم الطالب] وتقدر تعدله">
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
