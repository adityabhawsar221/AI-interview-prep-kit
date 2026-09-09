import { describe, it, expect } from 'vitest';
import { appendixASchema, AppendixAKit } from '../pipeline/schema.js';

describe('Appendix A Schema & Integrity Validator', () => {
  const validKit: AppendixAKit = {
    source: {
      company: 'Acme Corp',
      company_url: 'https://acme.example.com',
      role: 'Staff Frontend Engineer',
      location: 'San Francisco, CA',
      jd_chars: 1250,
      researched_at: '2026-09-01T12:00:00Z',
      pages_used: ['https://acme.example.com/about'],
    },
    company_brief: {
      summary: 'Acme builds enterprise logistics solutions.',
      what_they_do: 'Develops distributed supply chain software.',
      sources: ['https://acme.example.com/about'],
    },
    role: {
      title: 'Staff Frontend Engineer',
      seniority: 'Staff',
      responsibilities: ['Architect micro-frontends', 'Mentor team members'],
      requirements: [
        { id: 'r1', text: '7+ years React experience', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'TypeScript deep familiarity', kind: 'technical', priority: 'must' },
        { id: 'r3', text: 'GraphQL knowledge', kind: 'technical', priority: 'nice' },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Explain React server components.',
        answer_outline: 'Zero bundle size, server-side execution.',
        difficulty: 3,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'technical',
        prompt: 'Explain conditional types in TypeScript.',
        answer_outline: 'T extends U ? X : Y.',
        difficulty: 2,
      },
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'What is hydration?',
        back: 'Attaching event listeners to server-rendered HTML.',
        requirement_ids: ['r1'],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: 'React internals', question_ids: ['q1'], minutes: 60 },
        { day: 2, focus: 'TypeScript typing', question_ids: ['q2'], minutes: 45 },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };

  it('successfully validates a valid Appendix A kit', () => {
    const parsed = appendixASchema.safeParse(validKit);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid question difficulty', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.questions[0].difficulty = 5; // Difficulty must be 1, 2, or 3
    const parsed = appendixASchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('rejects non-integer schedule minutes', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.schedule.days[0].minutes = 45.5; // Must be integer
    const parsed = appendixASchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('rejects broken question references in schedule', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.schedule.days[0].question_ids = ['q999']; // Does not exist
    const parsed = appendixASchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('rejects broken requirement references in questions', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.questions[0].requirement_ids = ['r999']; // Does not exist
    const parsed = appendixASchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
