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

const SYNC_EVENT = "madrasati:storage";

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    // نبلّغ باقي الأدوات المفتوحة اللي تستخدم نفس المفتاح
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: key }));
  } catch {
    // المساحة ممتلئة أو التخزين مقفل: نحاول نخفف البيانات القديمة
    try {
      if (Array.isArray(value) && value.length > 1) localStorage.setItem(PREFIX + key, JSON.stringify(value.slice(0, Math.ceil(value.length / 2))));
    } catch {}
  }
}

/**
 * حالة تنحفظ تلقائياً في localStorage.
 * القيمة مربوطة بمفتاحها، فلما يتغير المفتاح (مثلاً الصف أو المادة)
 * ما تنكتب القيمة القديمة على المفتاح الجديد.
 */
export function useStored<T>(key: string, initial: T) {
  const [st, setSt] = useState<{ k: string | null; v: T }>({ k: null, v: initial });
  const ready = st.k === key;

  useEffect(() => {
    setSt({ k: key, v: load(key, initial) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (st.k === key) save(key, st.v);
  }, [st, key]);

  useEffect(() => {
    const onSync = (e: Event) => {
      if ((e as CustomEvent).detail !== key) return;
      const fresh = load(key, initial);
      setSt((cur) => (cur.k === key && JSON.stringify(cur.v) === JSON.stringify(fresh) ? cur : { k: key, v: fresh }));
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // أثناء تبديل المفتاح نقرأ القيمة الجديدة مباشرة
  const value = ready ? st.v : st.k === null ? initial : load(key, initial);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) =>
      setSt((cur) => {
        const prev = cur.k === key ? cur.v : load(key, initial);
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        return { k: key, v };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

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

/** يحذف كل بيانات وضع المعلم من هذا الجهاز */
export function clearTeacherData(teacherTools: string[]) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const short = k.slice(PREFIX.length);
      if (short.startsWith("teacher:") || teacherTools.some((t) => short === `history:${t}`)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}
