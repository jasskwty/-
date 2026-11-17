"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { StudyContext } from "@/lib/constants";
import type { PickedImage } from "./image";

/**
 * حالة مشتركة بين الأدوات:
 * - السياق الحالي (الصف والمادة والوضع)
 * - «صندوق المكتبة»: صفحات جهّزها المستخدم من مكتبة الوزارة، ويقدر يضيفها لأي أداة
 * - التنقل بين التبويبات
 */
interface AppState {
  ctx: StudyContext;
  inbox: PickedImage[];
  addToInbox: (item: PickedImage) => void;
  takeFromInbox: (id: string) => PickedImage | undefined;
  goToTab: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({
  ctx,
  goToTab,
  children,
}: {
  ctx: StudyContext;
  goToTab: (id: string) => void;
  children: ReactNode;
}) {
  const [inbox, setInbox] = useState<PickedImage[]>([]);
  const addToInbox = useCallback((item: PickedImage) => setInbox((xs) => [item, ...xs.filter((x) => x.id !== item.id)].slice(0, 6)), []);
  const takeFromInbox = useCallback(
    (id: string) => {
      const item = inbox.find((x) => x.id === id);
      setInbox((xs) => xs.filter((x) => x.id !== id));
      return item;
    },
    [inbox],
  );
  const value = useMemo(() => ({ ctx, inbox, addToInbox, takeFromInbox, goToTab }), [ctx, inbox, addToInbox, takeFromInbox, goToTab]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}

/** الفصل الدراسي الحالي تقريباً: من فبراير إلى أغسطس = الثاني */
export function currentTerm(): 1 | 2 {
  const m = new Date().getMonth() + 1;
  return m >= 2 && m <= 8 ? 2 : 1;
}
