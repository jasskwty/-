"use client";
import { useState } from "react";
import { gradeLabel, subjectLabel } from "@/lib/constants";
import type { HistoryItem } from "@/lib/client/storage";
import { Button, cx } from "./ui";

function timeAgo(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "الحين";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return new Date(at).toLocaleDateString("ar-KW", { day: "numeric", month: "short" });
}

export function HistoryPanel<T>({
  items,
  activeId,
  onOpen,
  onRemove,
  onClear,
  title = "النتائج السابقة",
}: {
  items: HistoryItem<T>[];
  activeId?: string | null;
  onOpen: (item: HistoryItem<T>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          aria-expanded={open}
        >
          <span className={cx("transition-transform", open && "-rotate-90")}>◂</span>
          🕘 {title} ({items.length.toLocaleString("ar")})
        </button>
        {open && (
          <Button variant="danger" size="sm" onClick={() => confirm("تبي تمسح كل النتائج المحفوظة؟") && onClear()}>
            مسح الكل
          </Button>
        )}
      </div>
      {open && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {items.map((it) => (
            <li key={it.id} className={cx("flex items-center gap-2", it.id === activeId && "bg-brand-50 dark:bg-brand-900/20")}>
              <button
                type="button"
                onClick={() => onOpen(it)}
                className="min-w-0 flex-1 px-4 py-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="block truncate font-medium">{it.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {subjectLabel(it.subject)} · {gradeLabel(it.grade)} · {timeAgo(it.at)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(it.id)}
                className="me-2 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                aria-label="احذف"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
