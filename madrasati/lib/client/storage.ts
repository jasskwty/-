"use client";
import { useCallback, useEffect, useState } from "react";

const PREFIX = "madrasati:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // المساحة ممتلئة أو التخزين مقفل: نحاول نخفف البيانات القديمة
    try {
      if (Array.isArray(value) && value.length > 1) localStorage.setItem(PREFIX + key, JSON.stringify(value.slice(0, Math.ceil(value.length / 2))));
    } catch {}
  }
}

/** حالة تنحفظ تلقائياً في localStorage */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setValue(load(key, initial));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (ready) save(key, value);
  }, [key, value, ready]);
  return [value, setValue, ready] as const;
}

export interface HistoryItem<T> {
  id: string;
  at: number;
  label: string;
  grade: string;
  subject: string;
  data: T;
}

const HISTORY_LIMIT = 10;

/** آخر النتائج لكل أداة */
export function useHistory<T>(tool: string) {
  const [items, setItems] = useStored<HistoryItem<T>[]>(`history:${tool}`, []);
  const add = useCallback(
    (item: Omit<HistoryItem<T>, "id" | "at">) => {
      const full = { ...item, id: Math.random().toString(36).slice(2), at: Date.now() };
      setItems((prev) => [full, ...prev].slice(0, HISTORY_LIMIT));
      return full.id;
    },
    [setItems],
  );
  const update = useCallback(
    (id: string, data: T) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, data } : it))),
    [setItems],
  );
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((it) => it.id !== id)), [setItems]);
  const clear = useCallback(() => setItems([]), [setItems]);
  return { items, add, update, remove, clear };
}
