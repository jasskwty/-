"use client";
import { useState } from "react";
import { Button } from "./ui";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // احتياط للمتصفحات اللي تمنع clipboard
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        setState((await copyText(text)) ? "done" : "fail");
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "done" ? "✅ تم النسخ" : state === "fail" ? "تعذّر النسخ" : "📋 نسخ"}
    </Button>
  );
}

/** يطبع أقرب عنصر عليه data-print (النتيجة نفسها بدون باقي الصفحة) */
export function PrintButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        const target = (e.currentTarget as HTMLElement).closest("[data-print]");
        if (!target) return window.print();
        const html = document.documentElement;
        const wasDark = html.classList.contains("dark");
        target.setAttribute("data-print-active", "");
        document.body.classList.add("print-mode");
        html.classList.remove("dark"); // الطباعة دايماً بالألوان الفاتحة
        const cleanup = () => {
          target.removeAttribute("data-print-active");
          document.body.classList.remove("print-mode");
          if (wasDark) html.classList.add("dark");
          window.removeEventListener("afterprint", cleanup);
        };
        window.addEventListener("afterprint", cleanup);
        window.print();
      }}
    >
      🖨️ طباعة
    </Button>
  );
}

export function ResultActions({
  text,
  onMore,
  moreBusy,
  extra,
  printable,
  moreLabel = "اشرح أكثر",
}: {
  moreLabel?: string;
  text: string;
  onMore?: () => void;
  moreBusy?: boolean;
  extra?: React.ReactNode;
  printable?: boolean;
}) {
  return (
    <div className="no-print mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <CopyButton text={text} />
      {printable && <PrintButton />}
      {onMore && (
        <Button variant="ghost" size="sm" onClick={onMore} disabled={moreBusy}>
          💡 {moreLabel}
        </Button>
      )}
      {extra}
    </div>
  );
}
