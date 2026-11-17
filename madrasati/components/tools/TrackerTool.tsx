"use client";
import { useMemo, useState } from "react";
import { gradeLabel, subjectLabel, type StudyContext } from "@/lib/constants";
import { useStored } from "@/lib/client/storage";
import { hideNames, type Aliases } from "@/lib/client/privacy";
import { TextTool } from "../TextTool";
import { RosterImport, type RosterImportItem } from "../RosterImport";
import { normalizeAr } from "@/lib/subjectMatch";
import { Button, Card, EmptyHint, Field, Input, Segmented, Select, TextArea, cx } from "../ui";

// ===== نموذج البيانات (ينحفظ في متصفح المعلم فقط) =====
interface Student {
  id: string;
  name: string;
  note: string;
}
interface Assessment {
  id: string;
  title: string;
  max: number;
  skill: string;
  date: string;
}
interface Followup {
  id: string;
  studentId: string; // فاضي = متابعة عامة
  date: string;
  text: string;
  done: boolean;
}
interface ClassRec {
  id: string;
  name: string;
  grade: string;
  subject: string;
  students: Student[];
  assessments: Assessment[];
  scores: Record<string, number>; // `${studentId}:${assessmentId}`
  followups: Followup[];
}

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const key = (sid: string, aid: string) => `${sid}:${aid}`;

/** نسبة الطالب في كل التقييمات المرصودة */
function studentStats(c: ClassRec, s: Student) {
  const pcts = c.assessments
    .map((a) => {
      const v = c.scores[key(s.id, a.id)];
      return v == null || !a.max ? null : (v / a.max) * 100;
    })
    .filter((x): x is number => x != null);
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  const trend = pcts.length >= 2 ? pcts[pcts.length - 1] - pcts[pcts.length - 2] : 0;
  return { avg, trend, count: pcts.length };
}

function assessmentAvg(c: ClassRec, a: Assessment) {
  const vals = c.students.map((s) => c.scores[key(s.id, a.id)]).filter((v): v is number => v != null);
  return vals.length && a.max ? (vals.reduce((x, y) => x + y, 0) / vals.length / a.max) * 100 : null;
}

function pctBadge(p: number | null) {
  if (p == null) return "bg-slate-100 text-slate-500 dark:bg-slate-800";
  if (p < 50) return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";
  if (p < 75) return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
}

/** يبني بيانات الفصل للمساعد بالرموز بدل الأسماء */
function buildPayload(c: ClassRec, onlyStudent?: string) {
  const aliases: Aliases = {};
  c.students.forEach((s, i) => (aliases[`S${i + 1}`] = s.name));
  const code = (s: Student) => `S${c.students.indexOf(s) + 1}`;
  const students = onlyStudent ? c.students.filter((s) => s.id === onlyStudent) : c.students;
  const lines = [
    `الصف: ${gradeLabel(c.grade)} — المادة: ${subjectLabel(c.subject)}`,
    `عدد الطلاب في البيانات: ${students.length}`,
    "",
    "التقييمات:",
    ...c.assessments.map(
      (a, i) => `- A${i + 1}: ${hideNames(a.title, aliases)} (الدرجة من ${a.max}) — المهارة: ${a.skill || "غير محددة"}${a.date ? ` — ${a.date}` : ""}`,
    ),
    "",
    "جدول الدرجات (فاضي = لم تُرصد):",
    `| الطالب | ${c.assessments.map((_, i) => `A${i + 1}`).join(" | ")} | المعدل % |`,
    `|---|${c.assessments.map(() => "---|").join("")}---|`,
    ...students.map((s) => {
      const st = studentStats(c, s);
      return `| ${code(s)} | ${c.assessments.map((a) => c.scores[key(s.id, a.id)] ?? "").join(" | ")} | ${st.avg == null ? "" : Math.round(st.avg)} |`;
    }),
  ];
  const notes = students.filter((s) => s.note.trim());
  if (notes.length) {
    lines.push("", "ملاحظات المعلم:");
    notes.forEach((s) => lines.push(`- ${code(s)}: ${hideNames(s.note, aliases)}`));
  }
  return { text: lines.join("\n"), aliases };
}

function exportCsv(c: ClassRec) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["الطالب", ...c.assessments.map((a) => `${a.title} (/${a.max})`), "المعدل %", "ملاحظات"];
  const rows = c.students.map((s) => {
    const st = studentStats(c, s);
    return [s.name, ...c.assessments.map((a) => c.scores[key(s.id, a.id)] ?? ""), st.avg == null ? "" : Math.round(st.avg), s.note];
  });
  const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n"); // BOM عشان Excel يقرأ العربي
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `سجل ${c.name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ===== الأداة =====
export function TrackerTool({ ctx }: { ctx: StudyContext }) {
  const [classes, setClasses] = useStored<ClassRec[]>("teacher:tracker:classes", []);
  const [activeId, setActiveId] = useStored<string>("teacher:tracker:active", "");
  const [view, setView] = useState<"grades" | "analysis" | "followups">("grades");
  const [newClass, setNewClass] = useState("");
  const [rosterOpen, setRosterOpen] = useState(false);
  const [notice, setNotice] = useState("");

  /** يضيف الفصول المقروءة من الكشف: فصول جديدة أو دمج بدون تكرار */
  function importRoster(items: RosterImportItem[]) {
    let firstId = "";
    let added = 0;
    let skipped = 0;
    let next = [...classes];
    for (const it of items) {
      if (it.target === "new") {
        const c: ClassRec = {
          id: uid(),
          name: it.name,
          grade: it.grade || ctx.grade,
          subject: ctx.subject,
          students: it.students.map((name) => ({ id: uid(), name, note: "" })),
          assessments: [],
          scores: {},
          followups: [],
        };
        added += c.students.length;
        next.push(c);
        firstId ||= c.id;
      } else {
        next = next.map((c) => {
          if (c.id !== it.target) return c;
          const have = new Set(c.students.map((st) => normalizeAr(st.name)));
          const fresh: string[] = [];
          for (const n of it.students) {
            const k = normalizeAr(n);
            if (have.has(k)) skipped++;
            else {
              have.add(k);
              fresh.push(n);
            }
          }
          added += fresh.length;
          firstId ||= c.id;
          return { ...c, students: [...c.students, ...fresh.map((name) => ({ id: uid(), name, note: "" }))] };
        });
      }
    }
    setClasses(next);
    if (firstId) setActiveId(firstId);
    setNotice(`✅ أضفنا ${added} طالب${skipped ? ` (وتجاهلنا ${skipped} اسم موجود من قبل)` : ""} في ${items.length} ${items.length === 1 ? "فصل" : "فصول"}.`);
  }

  const cls = classes.find((c) => c.id === activeId) ?? classes[0];
  const update = (fn: (c: ClassRec) => ClassRec) => setClasses((xs) => xs.map((c) => (c.id === cls?.id ? fn(c) : c)));

  const dueCount = cls ? cls.followups.filter((f) => !f.done && f.date <= today()).length : 0;

  function createClass() {
    const name = newClass.trim();
    if (!name) return;
    const c: ClassRec = { id: uid(), name, grade: ctx.grade, subject: ctx.subject, students: [], assessments: [], scores: {}, followups: [] };
    setClasses((xs) => [...xs, c]);
    setActiveId(c.id);
    setNewClass("");
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          {classes.length > 0 && (
            <Field label="الفصل" className="min-w-40 flex-1">
              <Select value={cls?.id} onChange={(e) => setActiveId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {subjectLabel(c.subject)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <form
            className="flex flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createClass();
            }}
          >
            <Field label="فصل جديد" className="flex-1">
              <Input value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder="مثال: عاشر ٣" maxLength={40} />
            </Field>
            <Button type="submit" variant="secondary" disabled={!newClass.trim()}>
              ➕ أضف
            </Button>
          </form>
          <Button onClick={() => setRosterOpen(true)}>📷 صوّر الكشف</Button>
          {cls && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!confirm(`تبي تحذف فصل «${cls.name}» وكل درجاته من هذا الجهاز؟`)) return;
                setClasses((xs) => xs.filter((c) => c.id !== cls.id));
                setActiveId("");
              }}
            >
              🗑️ حذف الفصل
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          🔒 السجل محفوظ في هذا المتصفح فقط، وما ينرفع لأي سيرفر. عند التحليل، الأسماء تتبدل برموز (S1، S2…) قبل الإرسال.
        </p>
      </Card>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
          <span className="flex-1">{notice} راجع الأسماء في الجدول.</span>
          <button type="button" onClick={() => setNotice("")} aria-label="إخفاء">
            ✕
          </button>
        </div>
      )}
      {rosterOpen && (
        <RosterImport
          ctx={ctx}
          existing={classes.map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setRosterOpen(false)}
          onImport={importRoster}
        />
      )}
      {!cls ? (
        <EmptyHint icon="📊" title="سجل متابعة الطلاب" text="صوّر كشف الفصل (أو كشوف كل فصولك مرة وحدة) بزر «📷 صوّر الكشف»، أو أضف فصل وطلاب يدوياً. السجل يحسب المعدلات ويحدد اللي يحتاج دعم، والمساعد يحلل ويقترح مسارات وتقارير." />
      ) : (
        <>
          <Segmented
            label="القسم"
            value={view}
            onChange={setView}
            options={[
              { value: "grades", label: "📋 الدرجات" },
              { value: "analysis", label: "📈 التحليل والتقارير" },
              { value: "followups", label: `🗓️ المتابعات${dueCount ? ` (${dueCount})` : ""}` },
            ]}
          />
          {view === "grades" && <GradesView cls={cls} update={update} />}
          {view === "analysis" && <AnalysisView cls={cls} ctx={ctx} />}
          {view === "followups" && <FollowupsView cls={cls} update={update} />}
        </>
      )}
    </div>
  );
}

// ===== الدرجات =====
function GradesView({ cls, update }: { cls: ClassRec; update: (fn: (c: ClassRec) => ClassRec) => void }) {
  const [names, setNames] = useState("");
  const [title, setTitle] = useState("");
  const [max, setMax] = useState("10");
  const [skill, setSkill] = useState("");

  const skills = useMemo(() => {
    const map = new Map<string, number[]>();
    cls.assessments.forEach((a) => {
      const p = assessmentAvg(cls, a);
      if (a.skill && p != null) map.set(a.skill, [...(map.get(a.skill) ?? []), p]);
    });
    return [...map.entries()].map(([s, ps]) => ({ skill: s, avg: ps.reduce((x, y) => x + y, 0) / ps.length })).sort((a, b) => a.avg - b.avg);
  }, [cls]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 sm:p-4">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const list = names.split(/\n|،|,/).map((n) => n.trim()).filter(Boolean);
              if (!list.length) return;
              update((c) => ({ ...c, students: [...c.students, ...list.map((name) => ({ id: uid(), name, note: "" }))] }));
              setNames("");
            }}
          >
            <Field label="أضف طلاب" hint="اسم في كل سطر، أو الصقهم من Excel">
              <TextArea rows={3} value={names} onChange={(e) => setNames(e.target.value)} placeholder={"محمد\nفاطمة\nعبدالله"} />
            </Field>
            <Button type="submit" size="sm" variant="secondary" disabled={!names.trim()}>
              👥 أضف الطلاب
            </Button>
          </form>
        </Card>
        <Card className="p-4 sm:p-4">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              update((c) => ({
                ...c,
                assessments: [...c.assessments, { id: uid(), title: title.trim(), max: Math.max(1, Number(max) || 10), skill: skill.trim(), date: today() }],
              }));
              setTitle("");
              setSkill("");
            }}
          >
            <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">أضف تقييم</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم التقييم، مثال: اختبار قصير ١" aria-label="اسم التقييم" maxLength={60} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" inputMode="numeric" min={1} value={max} onChange={(e) => setMax(e.target.value)} aria-label="الدرجة العظمى" placeholder="من" />
              <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="المهارة (اختياري)" aria-label="المهارة" maxLength={40} />
            </div>
            <Button type="submit" size="sm" variant="secondary" disabled={!title.trim()}>
              📝 أضف التقييم
            </Button>
          </form>
        </Card>
      </div>

      {cls.students.length > 0 && (
        <Card className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <th className="sticky right-0 z-10 bg-slate-50 px-3 py-2 text-start dark:bg-slate-800">الطالب</th>
                  {cls.assessments.map((a) => (
                    <th key={a.id} className="px-2 py-2 text-center font-bold">
                      <div className="flex items-center justify-center gap-1">
                        <span>{a.title}</span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-600"
                          aria-label={`احذف ${a.title}`}
                          onClick={() =>
                            confirm(`تحذف تقييم «${a.title}» ودرجاته؟`) &&
                            update((c) => ({ ...c, assessments: c.assessments.filter((x) => x.id !== a.id) }))
                          }
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-xs font-normal text-slate-500">
                        من {a.max}
                        {a.skill && ` · ${a.skill}`}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center">المعدل</th>
                  <th className="px-3 py-2 text-start">ملاحظة (بدون معلومات حساسة)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cls.students.map((s) => {
                  const st = studentStats(cls, s);
                  return (
                    <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="sticky right-0 z-10 bg-white px-3 py-1.5 font-bold whitespace-nowrap dark:bg-slate-900">{s.name}</td>
                      {cls.assessments.map((a) => (
                        <td key={a.id} className="px-1 py-1 text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={a.max}
                            step="0.5"
                            value={cls.scores[key(s.id, a.id)] ?? ""}
                            aria-label={`درجة ${s.name} في ${a.title}`}
                            onChange={(e) => {
                              const raw = e.target.value;
                              update((c) => {
                                const scores = { ...c.scores };
                                if (raw === "") delete scores[key(s.id, a.id)];
                                else scores[key(s.id, a.id)] = Math.min(a.max, Math.max(0, Number(raw)));
                                return { ...c, scores };
                              });
                            }}
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-center">
                        <span className={cx("inline-flex min-w-14 justify-center rounded-full px-2 py-0.5 font-bold", pctBadge(st.avg))}>
                          {st.avg == null ? "—" : `${Math.round(st.avg)}%`}
                          {st.trend > 5 ? " ↑" : st.trend < -5 ? " ↓" : ""}
                        </span>
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={s.note}
                          onChange={(e) =>
                            update((c) => ({ ...c, students: c.students.map((x) => (x.id === s.id ? { ...x, note: e.target.value } : x)) }))
                          }
                          aria-label={`ملاحظة ${s.name}`}
                          maxLength={200}
                          className="w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="px-2">
                        <button
                          type="button"
                          aria-label={`احذف ${s.name}`}
                          className="text-slate-400 hover:text-red-600"
                          onClick={() => confirm(`تحذف ${s.name} من السجل؟`) && update((c) => ({ ...c, students: c.students.filter((x) => x.id !== s.id) }))}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {cls.assessments.length > 0 && (
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800/60">
                    <td className="sticky right-0 bg-slate-50 px-3 py-2 dark:bg-slate-800">متوسط الفصل</td>
                    {cls.assessments.map((a) => {
                      const p = assessmentAvg(cls, a);
                      return (
                        <td key={a.id} className="px-2 py-2 text-center">
                          <span className={cx("rounded-full px-2 py-0.5", pctBadge(p))}>{p == null ? "—" : `${Math.round(p)}%`}</span>
                        </td>
                      );
                    })}
                    <td colSpan={3} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => exportCsv(cls)}>
              ⬇️ تصدير Excel (CSV)
            </Button>
            <span className="text-xs text-slate-500">↑ تحسن · ↓ تراجع (مقارنة بآخر تقييمين)</span>
          </div>
        </Card>
      )}

      {skills.length > 0 && (
        <Card className="p-4 sm:p-4">
          <div className="mb-2 font-bold">🎯 مستوى الفصل حسب المهارة</div>
          <div className="space-y-2">
            {skills.map((k) => (
              <div key={k.skill} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm">{k.skill}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cx("h-full rounded-full", k.avg < 50 ? "bg-red-500" : k.avg < 75 ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${Math.round(k.avg)}%` }}
                  />
                </div>
                <span className="w-12 text-sm font-bold">{Math.round(k.avg)}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ===== التحليل والتقارير (بالرموز) =====
function AnalysisView({ cls, ctx }: { cls: ClassRec; ctx: StudyContext }) {
  const [focus, setFocus] = useState("");
  const [who, setWho] = useState("");
  const [preview, setPreview] = useState(false);
  const hasData = cls.students.length > 0 && Object.keys(cls.scores).length > 0;
  const payload = buildPayload(cls, who || undefined);

  return (
    <TextTool
      tool="tracker"
      ctx={ctx}
      empty={
        <EmptyHint
          icon="📈"
          title={hasData ? "جاهز للتحليل" : "أضف درجات أول"}
          text="المساعد يحدد نقاط القوة والضعف لكل طالب، ويقترح مسارات تعلم ومجموعات ومتابعات، أو يكتب مسودات تقارير دورية."
        />
      }
      form={({ run, busy }) => (
        <Card>
          <div className="space-y-4">
            <Field label="ركّز على (اختياري)">
              <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="مثال: الطلاب اللي تراجعوا في آخر اختبار" maxLength={300} />
            </Field>
            <Field label="الطلاب">
              <Select value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">كل الطلاب</option>
                {cls.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>🔒 اللي بيوصل للمساعد: رموز ودرجات فقط، بدون أي اسم.</span>
                <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
                  👁️ {preview ? "إخفاء" : "شوف"} البيانات المرسلة
                </Button>
              </div>
              {preview && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 text-xs whitespace-pre-wrap dark:bg-slate-900" dir="rtl" data-testid="payload-preview">
                  {payload.text}
                </pre>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!hasData || busy}
                onClick={() =>
                  run({
                    body: { mode: "analysis", data: payload.text, focus },
                    label: `تحليل ${cls.name}${who ? ` — ${cls.students.find((s) => s.id === who)?.name}` : ""}`,
                    request: `تحليل أداء الفصل:\n${payload.text}`,
                    aliases: payload.aliases,
                  })
                }
              >
                🔍 حلّل واقترح مسارات
              </Button>
              <Button
                variant="secondary"
                disabled={!hasData || busy}
                onClick={() =>
                  run({
                    body: { mode: "reports", data: payload.text, focus },
                    label: `تقارير ${cls.name}${who ? ` — ${cls.students.find((s) => s.id === who)?.name}` : ""}`,
                    request: `تقارير دورية للطلاب:\n${payload.text}`,
                    aliases: payload.aliases,
                  })
                }
              >
                📝 اكتب تقارير دورية وتغذية راجعة
              </Button>
            </div>
          </div>
        </Card>
      )}
    />
  );
}

// ===== المتابعات =====
function FollowupsView({ cls, update }: { cls: ClassRec; update: (fn: (c: ClassRec) => ClassRec) => void }) {
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(addDays(today(), 7));
  const [text, setText] = useState("");
  const t = today();
  const sorted = [...cls.followups].sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
  const nameOf = (id: string) => cls.students.find((s) => s.id === id)?.name;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-4">
        <form
          className="grid gap-2 sm:grid-cols-[12rem_10rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            update((c) => ({ ...c, followups: [...c.followups, { id: uid(), studentId, date, text: text.trim(), done: false }] }));
            setText("");
          }}
        >
          <Field label="الطالب">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">متابعة عامة للفصل</option>
              {cls.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الموعد">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="المتابعة">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="مثال: اتصال بولي الأمر، أو إعادة اختبار الكسور" maxLength={200} />
          </Field>
          <Button type="submit" disabled={!text.trim()}>
            🗓️ جدول
          </Button>
        </form>
      </Card>
      {sorted.length === 0 ? (
        <EmptyHint icon="🗓️" title="ما فيه متابعات" text="جدول متابعاتك مع الطلاب وأولياء الأمور، وبتطلع لك المتأخرة بالأحمر." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {sorted.map((f) => {
            const late = !f.done && f.date < t;
            const isToday = !f.done && f.date === t;
            return (
              <li key={f.id} className={cx("flex items-center gap-3 px-4 py-3", f.done && "opacity-50")}>
                <input
                  type="checkbox"
                  checked={f.done}
                  aria-label="تمت"
                  className="size-5 accent-brand-600"
                  onChange={(e) =>
                    update((c) => ({ ...c, followups: c.followups.map((x) => (x.id === f.id ? { ...x, done: e.target.checked } : x)) }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className={cx("font-medium", f.done && "line-through")}>{f.text}</div>
                  <div className="text-xs text-slate-500">{f.studentId ? nameOf(f.studentId) ?? "طالب محذوف" : "عام"}</div>
                </div>
                <span
                  className={cx(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                    late ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" : isToday ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : "bg-slate-100 dark:bg-slate-800",
                  )}
                >
                  {late ? `متأخرة · ${f.date}` : isToday ? "اليوم" : f.date}
                </span>
                <button
                  type="button"
                  aria-label="احذف المتابعة"
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => update((c) => ({ ...c, followups: c.followups.filter((x) => x.id !== f.id) }))}
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
