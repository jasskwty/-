"use client";
import { useEffect, useRef, useState } from "react";
import { subjectLabel, type StudyContext } from "@/lib/constants";
import { fileToAttachment, toPayload, type PickedImage } from "@/lib/client/image";
import { streamPost } from "@/lib/client/stream";
import { useStored } from "@/lib/client/storage";
import { ImageInput } from "../ImageInput";
import { Markdown } from "../Markdown";
import { CopyButton } from "../ResultActions";
import { HistoryPanel } from "../HistoryPanel";
import { Button, Card, ErrorBox, Spinner, Toggle, cx } from "../ui";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  images?: string[]; // معاينات (ما تنحفظ)
  fileNames?: string[];
  hadImages?: boolean;
}
interface Conversation {
  id: string;
  at: number;
  label: string;
  grade: string;
  subject: string;
  data: ChatMessage[];
}

const MAX_SAVED = 10;
const MORE_PROMPT = "اشرح أكثر بطريقة أبسط ومع مثال إضافي.";
const MORE_PROMPT_TEACHER = "فصّل أكثر، وعطني بدائل وأفكار تطبيق عملية في الصف.";

const STARTERS: Record<string, string[]> = {
  math: ["كيف أحل معادلة من الدرجة الثانية؟", "وش الفرق بين المساحة والمحيط؟"],
  physics: ["اشرح لي قانون نيوتن الثاني بمثال", "وش الفرق بين السرعة والتسارع؟"],
  chemistry: ["كيف أوزن معادلة كيميائية؟", "وش هو المول؟"],
  biology: ["اشرح لي عملية البناء الضوئي", "وش الفرق بين الانقسام المتساوي والمنصف؟"],
  arabic: ["وش الفرق بين المبتدأ والفاعل؟", "كيف أعرب جملة كان وأخواتها؟"],
  english: ["When do I use present perfect?", "Help me write a paragraph about my school"],
  default: ["لخّص لي أهم أفكار هذا الدرس", "عطني خطة مذاكرة سريعة لهذي المادة"],
};

const TEACHER_STARTERS = [
  "عطني ٥ أفكار تهيئة ممتعة لبداية الحصة",
  "كيف أتعامل مع طالب كثير المقاطعة؟",
  "اقترح لعبة تعليمية لمراجعة الوحدة",
  "كيف أشرح مفهوم صعب بطريقة مبسطة؟",
];

export function ChatTool({ ctx }: { ctx: StudyContext }) {
  const teacher = ctx.role === "teacher";
  const [saved, setSaved] = useStored<Conversation[]>(teacher ? "teacher:chat:conversations" : "chat:conversations", []);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [hard, setHard] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (streaming) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, streaming]);

  function persist(id: string, msgs: ChatMessage[]) {
    const clean = msgs.map(({ role, text, images, hadImages }) => ({ role, text, hadImages: hadImages || !!images?.length }));
    const firstUser = clean.find((m) => m.role === "user")?.text || "محادثة بالصور";
    setSaved((prev) => {
      const conv: Conversation = {
        id,
        at: Date.now(),
        label: firstUser.slice(0, 60),
        grade: ctx.grade,
        subject: ctx.subject,
        data: clean,
      };
      return [conv, ...prev.filter((c) => c.id !== id)].slice(0, MAX_SAVED);
    });
  }

  async function send(textArg?: string, history = messages) {
    const text = (textArg ?? input).trim();
    if ((!text && !images.length) || streaming) return;
    const userMsg: ChatMessage = { role: "user", text, images: images.map((i) => i.preview), fileNames: images.map((i) => i.name ?? "") };
    const payloadImages = toPayload(images);
    const base = [...history, userMsg];
    setMessages([...base, { role: "assistant", text: "" }]);
    setInput("");
    setImages([]);
    setError("");
    setStreaming(true);
    const id = convId ?? Math.random().toString(36).slice(2);
    setConvId(id);

    const ac = new AbortController();
    abortRef.current = ac;
    const apiMessages = base.map((m, i) => ({
      role: m.role,
      text: m.text,
      hadImages: m.hadImages || !!m.images?.length,
      ...(i === base.length - 1 ? { images: payloadImages } : {}),
    }));
    let answer = "";
    try {
      answer = await streamPost(
        "/api/chat",
        { ...ctx, messages: apiMessages, hard },
        (t) => {
          answer = t;
          setMessages([...base, { role: "assistant", text: t }]);
        },
        ac.signal,
      );
      const final = [...base, { role: "assistant" as const, text: answer }];
      setMessages(final);
      persist(id, final);
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      if (!aborted) setError((e as Error).message);
      // نخلي الجزء اللي وصل، ونشيل الرد الفاضي
      const kept = answer ? [...base, { role: "assistant" as const, text: answer }] : base;
      setMessages(kept);
      if (answer) persist(id, kept);
      if (!answer && !aborted) {
        // نرجّع السؤال لمربع الكتابة عشان الطالب يعيد المحاولة بسهولة
        setMessages(history);
        setInput(text);
      }
    } finally {
      if (abortRef.current === ac) setStreaming(false);
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages([]);
    setConvId(null);
    setError("");
    setInput("");
    setImages([]);
    taRef.current?.focus();
  }

  const starters = teacher ? TEACHER_STARTERS : (STARTERS[ctx.subject] ?? STARTERS.default);
  const canSend = (input.trim() || images.length > 0) && !streaming;

  return (
    <div>
      <Card className="flex min-h-[60dvh] flex-col p-0 sm:p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <span className="font-bold">{teacher ? `💬 مساعدك التربوي — ${subjectLabel(ctx.subject)}` : `💬 معلم ${subjectLabel(ctx.subject)}`}</span>
          <Button variant="ghost" size="sm" onClick={newChat} disabled={!messages.length && !streaming}>
            ✨ محادثة جديدة
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="text-5xl" aria-hidden>
                {teacher ? "👩‍🏫" : "🧑‍🏫"}
              </span>
              <p className="max-w-sm text-slate-600 dark:text-slate-300">
                {teacher
                  ? `هلا أستاذ/ة! اسألني عن أي شي في تدريس ${subjectLabel(ctx.subject)}: أفكار شرح، أنشطة، أسئلة، أو إدارة الصف.`
                  : `هلا! أنا معلمك الخاص. اسألني أي سؤال في ${subjectLabel(ctx.subject)}، أو ارفع صورة من الكتاب أو الواجب.`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cx("flex", m.role === "user" ? "justify-start" : "justify-end")}>
              <div
                className={cx(
                  "max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%]",
                  m.role === "user"
                    ? "rounded-ss-md bg-brand-600 text-white"
                    : "rounded-se-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60",
                )}
              >
                {m.images && m.images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {m.images.map((src, j) =>
                      src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={src} alt="صورة مرفقة" className="max-h-40 rounded-lg" />
                      ) : (
                        <span key={j} className="rounded-lg bg-white/20 px-2 py-1 text-sm">
                          📄 {m.fileNames?.[j] ?? "PDF"}
                        </span>
                      ),
                    )}
                  </div>
                )}
                {!m.images?.length && m.hadImages && <div className="mb-1 text-xs opacity-80">📎 مرفق</div>}
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                ) : m.text ? (
                  <Markdown>{m.text}</Markdown>
                ) : (
                  <span className="flex items-center gap-2 text-slate-500">
                    <Spinner className="text-brand-500" /> يفكر…
                  </span>
                )}
                {m.role === "assistant" && m.text && !(streaming && i === messages.length - 1) && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-200 pt-2 dark:border-slate-700">
                    <CopyButton text={m.text} />
                    {i === messages.length - 1 && (
                      <Button variant="ghost" size="sm" onClick={() => send(teacher ? MORE_PROMPT_TEACHER : MORE_PROMPT)}>
                        💡 {teacher ? "فصّل أكثر" : "اشرح أكثر"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {error && <ErrorBox message={error} />}
          <div ref={endRef} />
        </div>

        <form
          className="space-y-2 border-t border-slate-100 p-3 dark:border-slate-800"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
            if (!files.length) return;
            e.preventDefault();
            Promise.all(files.slice(0, 4 - images.length).map((f) => fileToAttachment(f, true)))
              .then((imgs) => setImages((prev) => [...prev, ...imgs]))
              .catch((err) => setError((err as Error).message));
          }}
        >
          <ImageInput images={images} onChange={setImages} compact allowPdf />
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={8000}
              placeholder="اكتب سؤالك…"
              aria-label="اكتب سؤالك"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {streaming ? (
              <Button variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="إيقاف">
                ⏹
              </Button>
            ) : (
              <Button type="submit" disabled={!canSend} aria-label="أرسل">
                إرسال
              </Button>
            )}
          </div>
          <Toggle checked={hard} onChange={setHard} label={teacher ? "🧠 طلب معقد" : "🧠 سؤال صعب"} hint="يستخدم موديل أقوى للمسائل المعقدة" />
        </form>
      </Card>

      <HistoryPanel
        title="المحادثات السابقة"
        items={saved}
        activeId={convId}
        onOpen={(c) => {
          abortRef.current?.abort();
          setStreaming(false);
          setError("");
          setConvId(c.id);
          setMessages(c.data);
        }}
        onRemove={(id) => {
          setSaved((s) => s.filter((c) => c.id !== id));
          if (id === convId) newChat();
        }}
        onClear={() => {
          setSaved([]);
          newChat();
        }}
      />
    </div>
  );
}
