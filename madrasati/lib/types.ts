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

export interface Slide {
  title: string;
  bullets: string[];
  notes: string;
}
export interface Presentation {
  title: string;
  subtitle: string;
  slides: Slide[];
}
