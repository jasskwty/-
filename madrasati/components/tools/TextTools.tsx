"use client";
import { useState } from "react";
import { subjectLabel, type StudyContext } from "@/lib/constants";
import { toPayload, type PickedImage } from "@/lib/client/image";
import { useStored } from "@/lib/client/storage";
import { ImageInput } from "../ImageInput";
import { TextTool } from "../TextTool";
import { Button, Card, EmptyHint, Field, Input, Select, TextArea, Toggle } from "../ui";

const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s);

// ===== ٢. اشرح درس =====
export function ExplainTool({ ctx }: { ctx: StudyContext }) {
  const [topic, setTopic] = useState("");
  return (
    <TextTool
      tool="explain"
      ctx={ctx}
      empty={<EmptyHint icon="📘" title="اكتب اسم الدرس" text="بيطلع لك شرح خطوة بخطوة، أمثلة محلولة، أخطاء شائعة، و٣ أسئلة تدريب." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!topic.trim() || busy) return;
              run({ body: { input: topic }, label: topic, request: `اشرح لي درس: ${topic}` });
            }}
          >
            <Field label="الدرس أو الموضوع" className="flex-1">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={ctx.subject === "math" ? "مثال: حل المعادلات من الدرجة الثانية" : `مثال: درس من مادة ${subjectLabel(ctx.subject)}`}
                maxLength={500}
              />
            </Field>
            <Button type="submit" disabled={!topic.trim() || busy}>
              📘 اشرح لي
            </Button>
          </form>
        </Card>
      )}
    />
  );
}

// ===== نموذج نص + صورة مشترك =====
function TextImageForm({
  busy,
  placeholder,
  submitLabel,
  onSubmit,
  withHard,
  topicField,
}: {
  busy: boolean;
  placeholder: string;
  submitLabel: string;
  onSubmit: (v: { text: string; images: PickedImage[]; hard: boolean; topic: string }) => void;
  withHard?: boolean;
  topicField?: { label: string; placeholder: string };
}) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [hard, setHard] = useState(false);
  const can = (text.trim() || images.length > 0) && !busy;
  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (can) onSubmit({ text, images, hard, topic });
        }}
      >
        {topicField && (
          <Field label={topicField.label}>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={topicField.placeholder} maxLength={200} />
          </Field>
        )}
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={6}
          maxLength={20000}
          aria-label="النص"
        />
        <ImageInput images={images} onChange={setImages} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {withHard ? (
            <Toggle checked={hard} onChange={setHard} label="🧠 مسألة صعبة" hint="يستخدم موديل أقوى (أبطأ شوي)" />
          ) : (
            <span />
          )}
          <Button type="submit" disabled={!can}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ===== ٣. حل واجب =====
export function SolveTool({ ctx }: { ctx: StudyContext }) {
  return (
    <TextTool
      tool="solve"
      ctx={ctx}
      empty={<EmptyHint icon="✏️" title="اكتب السؤال أو صوّره" text="بيطلع لك الحل بالخطوات مع الجواب النهائي. فعّل «مسألة صعبة» للمسائل المعقدة." />}
      form={({ run, busy }) => (
        <TextImageForm
          busy={busy}
          withHard
          placeholder="اكتب نص السؤال هنا، أو ارفع صورة الواجب…"
          submitLabel="✏️ حل الواجب"
          onSubmit={({ text, images, hard }) =>
            run({
              body: { input: text, images: toPayload(images), hard },
              label: text.trim() ? short(text.trim()) : "واجب من صورة",
              request: text.trim() ? `حل هذا الواجب: ${text}` : "حل الواجب الموجود في الصورة",
            })
          }
        />
      )}
    />
  );
}

// ===== ٦. لخّص =====
export function SummarizeTool({ ctx }: { ctx: StudyContext }) {
  return (
    <TextTool
      tool="summarize"
      ctx={ctx}
      empty={<EmptyHint icon="📝" title="الصق النص أو صوّر الصفحة" text="بيطلع لك ملخص بنقاط، وتعاريف، وقوانين." />}
      form={({ run, busy }) => (
        <TextImageForm
          busy={busy}
          placeholder="الصق نص الدرس هنا، أو ارفع صورة صفحة الكتاب…"
          submitLabel="📝 لخّص"
          onSubmit={({ text, images }) =>
            run({
              body: { input: text, images: toPayload(images) },
              label: text.trim() ? short(text.trim()) : "تلخيص صورة",
              request: text.trim() ? `لخّص هذا المحتوى: ${short(text, 3000)}` : "لخّص المحتوى الموجود في الصورة",
            })
          }
        />
      )}
    />
  );
}

// ===== ٧. صحّح تعبيري =====
export function EssayTool({ ctx }: { ctx: StudyContext }) {
  return (
    <TextTool
      tool="essay"
      ctx={ctx}
      empty={<EmptyHint icon="🖊️" title="اكتب تعبيرك" text="بيطلع لك جدول بالأخطاء وتصحيحها، ملاحظات على الأسلوب، درجة من ١٠، ونسخة محسّنة." />}
      form={({ run, busy }) => (
        <TextImageForm
          busy={busy}
          topicField={{ label: "عنوان التعبير (اختياري)", placeholder: "مثال: أهمية القراءة" }}
          placeholder="اكتب أو الصق التعبير هنا، أو ارفع صورة الورقة…"
          submitLabel="🖊️ صحّح تعبيري"
          onSubmit={({ text, images, topic }) =>
            run({
              body: { input: text, topic, images: toPayload(images) },
              label: topic.trim() || (text.trim() ? short(text.trim()) : "تعبير من صورة"),
              request: `صحّح تعبيري${topic ? ` بعنوان «${topic}»` : ""}: ${short(text, 4000)}`,
            })
          }
        />
      )}
    />
  );
}

// ===== ٩. جدول مذاكرة =====
interface Exam {
  id: string;
  subject: string;
  date: string;
  level: string;
}
const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const newExam = (subject = ""): Exam => ({ id: Math.random().toString(36).slice(2), subject, date: "", level: "متوسطة" });

export function ScheduleTool({ ctx }: { ctx: StudyContext }) {
  const [exams, setExams] = useStored<Exam[]>("schedule:exams", [newExam(subjectLabel(ctx.subject))]);
  const [hours, setHours] = useStored<number>("schedule:hours", 3);
  const [notes, setNotes] = useState("");

  const valid = exams.filter((e) => e.subject.trim() && e.date);
  const set = (id: string, patch: Partial<Exam>) => setExams((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <TextTool
      tool="schedule"
      ctx={ctx}
      empty={<EmptyHint icon="🗓️" title="أضف اختباراتك" text="حط المادة وتاريخ الاختبار لكل اختبار، وكم ساعة تقدر تذاكر باليوم، ويطلع لك جدول يومي." />}
      form={({ run, busy }) => (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid.length || busy) return;
              const sorted = [...valid].sort((a, b) => a.date.localeCompare(b.date));
              run({
                body: { exams: sorted, hours, today: todayISO(), input: notes },
                label: `جدول: ${sorted.map((x) => x.subject).join("، ")}`,
                request: `جدول مذاكرة لاختبارات: ${sorted.map((x) => `${x.subject} (${x.date})`).join("، ")}، ${hours} ساعات يومياً`,
              });
            }}
          >
            <div className="space-y-3">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">مواعيد الاختبارات</span>
              {exams.map((ex, i) => (
                <div key={ex.id} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_11rem_8rem_auto] dark:bg-slate-800/50">
                  <Input
                    className="col-span-2 sm:col-span-1"
                    value={ex.subject}
                    onChange={(e) => set(ex.id, { subject: e.target.value })}
                    placeholder={`المادة ${(i + 1).toLocaleString("ar")}`}
                    aria-label="المادة"
                    maxLength={60}
                  />
                  <Input type="date" min={todayISO()} value={ex.date} onChange={(e) => set(ex.id, { date: e.target.value })} aria-label="تاريخ الاختبار" />
                  <Select value={ex.level} onChange={(e) => set(ex.id, { level: e.target.value })} aria-label="الصعوبة">
                    <option value="سهلة">سهلة</option>
                    <option value="متوسطة">متوسطة</option>
                    <option value="صعبة">صعبة</option>
                  </Select>
                  <Button
                    variant="danger"
                    size="sm"
                    className="col-span-2 sm:col-span-1"
                    onClick={() => setExams((xs) => (xs.length > 1 ? xs.filter((x) => x.id !== ex.id) : [newExam()]))}
                    aria-label="احذف الاختبار"
                  >
                    🗑️ <span className="sm:hidden">احذف</span>
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setExams((xs) => [...xs, newExam()])} disabled={exams.length >= 15}>
                ➕ أضف اختبار
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`ساعات المذاكرة باليوم: ${hours.toLocaleString("ar")}`}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </Field>
              <Field label="ملاحظات (اختياري)">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: عندي تدريب كل ثلاثاء العصر" maxLength={500} />
              </Field>
            </div>
            <Button type="submit" disabled={!valid.length || busy} className="w-full sm:w-auto">
              🗓️ سوّ لي الجدول
            </Button>
          </form>
        </Card>
      )}
    />
  );
}
