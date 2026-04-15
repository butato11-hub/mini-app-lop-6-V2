export type Subject = 'Lịch sử' | 'Địa lý' | 'KHTN' | 'GDCD' | 'Công nghệ' | 'Tin học';

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of the correct option
  explanation?: string;
}

export interface QuizData {
  subject: Subject;
  questions: Question[];
}

export interface StudyContent {
  subject: Subject;
  content: string; // Markdown content
}

export interface AppState {
  view: 'welcome' | 'home' | 'study' | 'quiz' | 'result' | 'upload';
  userName?: string;
  userIcon?: string;
  selectedSubject?: Subject;
  quizData?: QuizData;
  studyContent?: StudyContent;
  currentQuestionIndex: number;
  userAnswers: number[];
  score: number;
}
