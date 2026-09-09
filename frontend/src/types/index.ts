export interface User {
  id: string;
  email: string;
}

export interface Requirement {
  id: string;
  text: string;
  kind: 'technical' | 'behavioural' | 'domain';
  priority: 'must' | 'nice';
}

export type QuestionCategory = 'technical' | 'behavioural' | 'system-design' | 'company-fit';

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  origin?: 'generated' | 'edited' | 'manual';
  is_pinned?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  origin?: 'generated' | 'edited' | 'manual';
  is_pinned?: boolean;
  confidence?: 1 | 2 | 3; // 1 = Needs Review, 2 = Uncertain, 3 = Mastered
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export interface RoleData {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface KitData {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: CompanyBrief;
  role: RoleData;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
}

export interface KitRecord {
  id: string;
  company: string;
  role: string;
  days_available: number;
  data: KitData;
  createdAt: string;
  updatedAt: string;
}

export interface JobProgress {
  id: string;
  stage: string;
  percent: number;
  progressMessage?: string;
  status: 'pending' | 'completed' | 'failed';
  kitId?: string;
  error?: string;
}
