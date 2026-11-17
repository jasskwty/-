// أشكال المخرجات المنظمة (JSON) المشتركة بين السيرفر والواجهة

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}
export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

export interface Flashcard {
  front: string;
  back: string;
}
export interface FlashcardDeck {
  title: string;
  cards: Flashcard[];
}

export type Priority = "high" | "medium" | "low";

export interface Slide {
  title: string;
  bullets: string[];
  notes: string;
  /** أولوية الشريحة في الاختبار (فاضي إذا العرض بدون تحليل اختبارات) */
  priority?: Priority | "";
}

/** بند من حصر الدرس في الاختبارات */
export interface ExamFocusItem {
  topic: string;
  priority: Priority;
  count: number; // كم مرة ظهر في الملفات
  question_types: string[];
  sources: string;
  tip: string;
}
export interface ExamFocus {
  lesson: string;
  coverage: string;
  items: ExamFocusItem[];
  sample_questions: string[];
  warnings: string;
}
export interface Presentation {
  title: string;
  subtitle: string;
  slides: Slide[];
}
