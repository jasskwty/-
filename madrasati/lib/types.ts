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

export const SLIDE_TYPES = ["bullets", "cards", "steps", "compare", "balance", "stats", "quote", "quiz", "timer", "problem", "vectors"] as const;
export type SlideType = (typeof SLIDE_TYPES)[number];

export interface SlideQuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
}

export interface Slide {
  title: string;
  bullets: string[];
  notes: string;
  /** أولوية الشريحة في الاختبار (فاضي إذا العرض بدون تحليل اختبارات) */
  priority?: Priority | "";
  // ===== الشرائح المتنوعة والتفاعلية (العروض القديمة ما فيها هذي الحقول) =====
  type?: SlideType;
  subtitle?: string;
  left_title?: string;
  left_items?: string[];
  right_title?: string;
  right_items?: string[];
  quiz?: SlideQuizQuestion[];
  stats?: { value: string; label: string }[];
  timer_minutes?: number;
  /** مسألة محلولة: الحل يطلع خطوة خطوة */
  problem?: SlideProblem;
  /** رسم متجهات تفاعلي (رأس بذيل) */
  vectors?: SlideVector[];
  unit?: string;
}

export interface SlideProblem {
  statement: string;
  given: string[];
  required: string;
  steps: string[];
  answer: string;
  source: string; // مصدر المسألة إذا منقولة من اختبار أو بنك أسئلة
}
export interface SlideVector {
  label: string;
  magnitude: number;
  angle: number; // بالدرجات من المحور السيني الموجب
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
