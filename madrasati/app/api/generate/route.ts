import { jsonError, streamTextResponse, UserFacingError } from "@/lib/server/claude";
import { readBody, readContext, readImages, readInt, readText, systemPrompt, TASKS, userContent } from "@/lib/server/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const TEXT_TOOLS = [
  "explain", "solve", "summarize", "essay", "schedule", "more",
  "lessonPlan", "worksheet", "grade", "rubric", "differentiate", "comments",
  "simplify", "scaffold", "tracker", "extractReference",
] as const;
type TaskKey = keyof typeof TASKS;

const ACTIVITY_KINDS: Record<string, TaskKey> = {
  differentiated: "differentiate",
  interactive: "interactive",
  experiment: "experiment",
  aids: "aids",
};
const LEVELS: Record<string, string> = {
  support: "مبسط جداً (للطلاب اللي يحتاجون دعم في القراءة)",
  grade: "مستوى الصف",
  advanced: "متقدم (إثرائي للمتفوقين)",
  l2: "مبسط لغوياً لغير الناطقين بالعربية",
};
const NEEDS: Record<string, string> = {
  dyslexia: "صعوبات القراءة (عسر القراءة)",
  adhd: "تشتت الانتباه وفرط الحركة",
  autism: "طيف التوحد",
  dyscalculia: "صعوبات الحساب",
  writing: "صعوبات الكتابة",
  slow: "بطء التعلم",
  gifted: "الموهوبين والمتفوقين",
  sensory: "ضعف السمع أو البصر",
  anxiety: "قلق الاختبارات أو ضعف الثقة",
};

const QUESTION_TYPES: Record<string, string> = {
  mcq: "اختيار من متعدد",
  tf: "صح وخطأ مع تصحيح الخطأ",
  fill: "أكمل الفراغ",
  short: "إجابة قصيرة / علّل",
  essay: "مقالي",
  problem: "مسائل",
  match: "توصيل",
  hots: "تفكير ناقد وحل مشكلات (مستويات عليا)",
};
const SHEET_KINDS: Record<string, string> = {
  worksheet: "ورقة عمل صفية",
  quiz: "اختبار قصير",
  exam: "اختبار شامل",
  homework: "واجب منزلي",
  bank: "بنك أسئلة",
};
const COMMENT_KINDS: Record<string, string> = {
  parent: "رسالة لولي الأمر",
  report: "ملاحظة للشهادة أو التقرير الدراسي",
  praise: "عبارات تعزيز وتشجيع للطالب",
  warning: "تنبيه لولي الأمر بخصوص مستوى أو سلوك",
  periodic: "تقرير دوري عن مستوى الطالب",
};

const opt = (v: unknown, label: string, max = 4000) => readText(v, label, { required: false, max });
type TextTool = (typeof TEXT_TOOLS)[number];

function buildRequest(
  tool: TextTool,
  body: Record<string, unknown>,
): { text: string; withImages: boolean; task?: TaskKey } {
  switch (tool) {
    case "explain": {
      const topic = readText(body.input, "اسم الدرس أو الموضوع", { max: 2000 });
      return { text: `اشرح لي درس: ${topic}`, withImages: false };
    }
    case "solve": {
      const input = readText(body.input, "نص السؤال", { required: false });
      return { text: input ? `حل هذا الواجب:\n\n${input}` : "حل الواجب الموجود في الصورة.", withImages: true };
    }
    case "summarize": {
      const input = readText(body.input, "النص", { required: false });
      return { text: input ? `لخّص هذا المحتوى:\n\n${input}` : "لخّص المحتوى الموجود في الصورة.", withImages: true };
    }
    case "essay": {
      const input = readText(body.input, "التعبير", { required: false });
      const topic = readText(body.topic, "عنوان التعبير", { required: false, max: 300 });
      return {
        text: `${topic ? `عنوان التعبير: ${topic}\n\n` : ""}${input ? `صحّح تعبيري:\n\n${input}` : "صحّح التعبير الموجود في الصورة."}`,
        withImages: true,
      };
    }
    case "schedule": {
      const exams = Array.isArray(body.exams) ? body.exams : [];
      const lines = exams
        .map((e: Record<string, unknown>) => {
          const subject = readText(e.subject, "اسم المادة", { required: false, max: 80 });
          const date = readText(e.date, "التاريخ", { required: false, max: 20 });
          const level = readText(e.level, "الصعوبة", { required: false, max: 20 });
          return subject && date ? `- ${subject}: ${date}${level ? ` (صعوبتها عندي: ${level})` : ""}` : "";
        })
        .filter(Boolean);
      if (!lines.length) throw new UserFacingError("أضف اختبار واحد على الأقل مع المادة والتاريخ.");
      const hours = readInt(body.hours, 1, 12, 3);
      const today = readText(body.today, "تاريخ اليوم", { max: 20 }) || new Date().toISOString().slice(0, 10);
      const notes = readText(body.input, "الملاحظات", { required: false, max: 1500 });
      return {
        text: `تاريخ اليوم: ${today}\nساعات المذاكرة اليومية: ${hours} ساعات\n\nمواعيد الاختبارات:\n${lines.join("\n")}${notes ? `\n\nملاحظات: ${notes}` : ""}`,
        withImages: false,
      };
    }
    case "lessonPlan": {
      const topic = readText(body.input, "عنوان الدرس", { max: 1000 });
      const minutes = readInt(body.minutes, 20, 120, 45);
      const notes = opt(body.notes, "الملاحظات", 2000);
      return {
        text: `حضّر لي درس: ${topic}\nزمن الحصة: ${minutes} دقيقة${notes ? `\nملاحظات وإمكانيات الصف: ${notes}` : ""}`,
        withImages: true,
      };
    }
    case "worksheet": {
      const topic = readText(body.input, "موضوع الورقة", { max: 2000 });
      const kind = SHEET_KINDS[String(body.kind)] ?? SHEET_KINDS.worksheet;
      const types = (Array.isArray(body.types) ? body.types : []).map((t) => QUESTION_TYPES[String(t)]).filter(Boolean);
      if (!types.length) throw new UserFacingError("اختر نوع واحد من الأسئلة على الأقل.");
      const count = readInt(body.count, 3, 40, 10);
      const level = readText(body.level, "المستوى", { required: false, max: 20 }) || "متنوع";
      const total = readInt(body.total, 0, 100, 0);
      const key = body.answerKey === true;
      const objectives = opt(body.objectives, "الأهداف", 3000);
      return {
        text: `النوع: ${kind}\nالموضوع: ${topic}\nأنواع الأسئلة: ${types.join("، ")}\nإجمالي عدد الأسئلة/البنود: ${count} تقريباً، موزعة على الأنواع\nمستوى الصعوبة: ${level}${total ? `\nالدرجة الكلية: ${total}` : ""}${objectives ? `\nالأهداف أو المعايير المرتبطة: ${objectives}` : ""}\nمفتاح الإجابة: ${key || kind === SHEET_KINDS.bank ? "نعم" : "لا تضفه"}`,
        withImages: true,
      };
    }
    case "grade": {
      const question = opt(body.question, "السؤال", 8000);
      const model = opt(body.modelAnswer, "نموذج الإجابة", 8000);
      const answer = opt(body.input, "إجابة الطالب", 12000);
      const total = readInt(body.total, 1, 100, 10);
      return {
        text: `${question ? `السؤال/الأسئلة:\n${question}\n\n` : ""}${model ? `نموذج الإجابة:\n${model}\n\n` : ""}الدرجة الكلية: ${total}\n\n${answer ? `إجابة الطالب:\n${answer}` : "إجابة الطالب في الصورة المرفقة."}`,
        withImages: true,
      };
    }
    case "rubric": {
      const task = readText(body.input, "وصف المهمة", { max: 3000 });
      const levels = readInt(body.levels, 3, 5, 4);
      const total = readInt(body.total, 0, 100, 0);
      return {
        text: `المهمة: ${task}\nعدد مستويات الأداء: ${levels}${total ? `\nالدرجة الكلية: ${total}` : ""}`,
        withImages: false,
      };
    }
    case "differentiate": {
      const topic = readText(body.input, "الهدف أو الموضوع", { max: 2000 });
      const minutes = readInt(body.minutes, 5, 90, 20);
      const mode = body.mode === "individual" ? "فردي" : "مجموعات";
      return {
        text: `الموضوع/الهدف: ${topic}\nزمن النشاط: ${minutes} دقيقة\nطريقة العمل: ${mode}`,
        withImages: false,
        task: ACTIVITY_KINDS[String(body.kind)] ?? "differentiate",
      };
    }
    case "comments": {
      const kind = COMMENT_KINDS[String(body.kind)] ?? COMMENT_KINDS.parent;
      // اسم الطالب ما يُرسل أبداً؛ الواجهة تعوّض [اسم الطالب] بعد وصول الرد
      const notes = readText(body.input, "ملاحظاتك عن الطالب", { max: 3000 });
      return { text: `النوع: ${kind}\nملاحظات المعلم عن [اسم الطالب]: ${notes}`, withImages: false };
    }
    case "simplify": {
      const input = opt(body.input, "النص", 15000);
      const levels = (Array.isArray(body.levels) ? body.levels : []).map((l) => LEVELS[String(l)]).filter(Boolean);
      if (!levels.length) throw new UserFacingError("اختر مستوى واحد على الأقل.");
      const extras = [body.vocab === true && "المفردات الأساسية", body.questions === true && "أسئلة فهم"].filter(Boolean);
      return {
        text: `المستويات المطلوبة: ${levels.join("، ")}\nإضافات مطلوبة: ${extras.length ? extras.join("، ") : "لا شيء"}\n\n${input ? `المحتوى:\n${input}` : "المحتوى في المرفقات."}`,
        withImages: true,
      };
    }
    case "scaffold": {
      const need = NEEDS[String(body.need)];
      if (!need) throw new UserFacingError("اختر نوع الاحتياج.");
      const topic = readText(body.input, "الدرس أو المهمة", { max: 2000 });
      const notes = opt(body.notes, "الملاحظات", 2000);
      return {
        text: `نوع الاحتياج: ${need}\nالدرس أو المهمة: ${topic}${notes ? `\nملاحظات المعلم (بدون أسماء): ${notes}` : ""}`,
        withImages: false,
      };
    }
    case "tracker": {
      const data = readText(body.data, "بيانات الفصل", { max: 30000 });
      const focus = opt(body.focus, "التركيز", 1000);
      const reports = body.mode === "reports";
      return {
        text: `${reports ? "اكتب تقارير دورية للطلاب التالية بياناتهم." : "حلّل أداء الفصل التالي."}${focus ? `\nركّز على: ${focus}` : ""}\n\n${data}`,
        withImages: false,
        task: reports ? "reports" : "tracker",
      };
    }
    case "extractReference": {
      const input = opt(body.input, "النص", 20000);
      return { text: input ? `المصدر:\n${input}` : "المصدر في المرفقات.", withImages: true };
    }
    case "more": {
      const previous = readText(body.previous, "الرد السابق", { max: 40000 });
      const request = readText(body.request, "الطلب الأصلي", { required: false, max: 4000 });
      return {
        text: `${request ? `طلبي الأصلي كان:\n${request}\n\n` : ""}وهذا الرد اللي وصلني:\n<previous>\n${previous}\n</previous>\n\nاشرح لي أكثر.`,
        withImages: false,
      };
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const ctx = readContext(body);
    const tool = TEXT_TOOLS.find((t) => t === body.tool);
    if (!tool) throw new UserFacingError("الأداة غير معروفة.");

    const { text, withImages, task: taskKey } = buildRequest(tool, body);
    const images = withImages ? readImages(body.images) : [];
    if (withImages && !images.length && !readText(body.input, "النص", { required: false }))
      throw new UserFacingError(tool === "grade" ? "اكتب إجابة الطالب أو ارفع صورة ورقته." : "اكتب النص أو ارفع صورة أول.");

    const task =
      tool === "more" && ctx.role === "teacher" ? TASKS.teacherMore : TASKS[taskKey ?? (tool as TaskKey)];
    return await streamTextResponse({
      system: systemPrompt(ctx, task),
      messages: [{ role: "user", content: userContent(text, images) }],
      // تصحيح أوراق الطلاب يحتاج دقة عالية
      hard: body.hard === true || tool === "grade",
    });
  } catch (err) {
    return jsonError(err);
  }
}
