import { z } from 'zod';

// Requirement schema
export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(['technical', 'behavioural', 'domain']),
  priority: z.enum(['must', 'nice']),
});

export type Requirement = z.infer<typeof requirementSchema>;

// Question schema (Appendix A)
export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export type Question = z.infer<typeof questionSchema>;

// Flashcard schema (Appendix A)
export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
});

export type Flashcard = z.infer<typeof flashcardSchema>;

// Schedule Day schema
export const scheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string().min(1),
  question_ids: z.array(z.string()),
  minutes: z.number().int().min(1),
});

export type ScheduleDay = z.infer<typeof scheduleDaySchema>;

// Schedule schema
export const scheduleSchema = z.object({
  days_available: z.number().int().min(1),
  days: z.array(scheduleDaySchema),
});

export type Schedule = z.infer<typeof scheduleSchema>;

// Full Appendix A Kit schema
export const appendixASchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int(),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: scheduleSchema,
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().min(1),
  }),
}).superRefine((val, ctx) => {
  // Validate that all question_ids in schedule refer to existing questions
  const questionIdSet = new Set(val.questions.map((q) => q.id));
  val.schedule.days.forEach((day, dIdx) => {
    day.question_ids.forEach((qId, qIdx) => {
      if (!questionIdSet.has(qId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Schedule day ${day.day} references unknown question_id "${qId}"`,
          path: ['schedule', 'days', dIdx, 'question_ids', qIdx],
        });
      }
    });
  });

  // Validate that all requirement_ids in questions refer to existing requirements
  const reqIdSet = new Set(val.role.requirements.map((r) => r.id));
  val.questions.forEach((q, qIdx) => {
    q.requirement_ids.forEach((rId, rIdx) => {
      if (!reqIdSet.has(rId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question "${q.id}" references unknown requirement_id "${rId}"`,
          path: ['questions', qIdx, 'requirement_ids', rIdx],
        });
      }
    });
  });
});

export type AppendixAKit = z.infer<typeof appendixASchema>;

// Internal extended question with preservation metadata
export interface EditableQuestion extends Question {
  origin?: 'generated' | 'edited' | 'manual';
  is_pinned?: boolean;
}

// Internal extended flashcard with preservation metadata
export interface EditableFlashcard extends Flashcard {
  origin?: 'generated' | 'edited' | 'manual';
  is_pinned?: boolean;
  confidence?: 1 | 2 | 3;
}

// Internal working kit
export interface WorkingKit extends Omit<AppendixAKit, 'questions' | 'flashcards'> {
  questions: EditableQuestion[];
  flashcards: EditableFlashcard[];
}

/**
 * Strips internal tracking metadata (origin, is_pinned, confidence)
 * and returns the exact Appendix A structure.
 */
export function toAppendixA(kit: WorkingKit): AppendixAKit {
  return {
    source: { ...kit.source },
    company_brief: { ...kit.company_brief },
    role: {
      title: kit.role.title,
      seniority: kit.role.seniority,
      responsibilities: [...kit.role.responsibilities],
      requirements: kit.role.requirements.map((r) => ({
        id: r.id,
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      })),
    },
    questions: kit.questions.map((q) => ({
      id: q.id,
      requirement_ids: [...q.requirement_ids],
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline,
      difficulty: q.difficulty,
    })),
    flashcards: kit.flashcards.map((f) => ({
      id: f.id,
      front: f.front,
      back: f.back,
      requirement_ids: [...f.requirement_ids],
    })),
    schedule: {
      days_available: kit.schedule.days_available,
      days: kit.schedule.days.map((d) => ({
        day: d.day,
        focus: d.focus,
        question_ids: [...d.question_ids],
        minutes: Math.round(d.minutes),
      })),
    },
    coverage: {
      uncovered_requirement_ids: [...kit.coverage.uncovered_requirement_ids],
      passes: kit.coverage.passes,
    },
  };
}
