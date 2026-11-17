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

export function ResultActions({
  text,
  onMore,
  moreBusy,
  extra,
}: {
  text: string;
  onMore?: () => void;
  moreBusy?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <CopyButton text={text} />
      {onMore && (
        <Button variant="ghost" size="sm" onClick={onMore} disabled={moreBusy}>
          💡 اشرح أكثر
        </Button>
      )}
      {extra}
    </div>
  );
}
