import { describe, it, expect } from 'vitest';
import { buildSchedule } from '../pipeline/scheduler.js';
import { Question, Requirement } from '../pipeline/schema.js';

describe('Deterministic Scheduler', () => {
  const sampleRequirements: Requirement[] = [
    { id: 'r1', text: 'Proficiency with React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: '5+ years distributed systems', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Experience mentoring interns', kind: 'behavioural', priority: 'nice' },
  ];

  const sampleQuestions: Question[] = [
    {
      id: 'q1',
      requirement_ids: ['r1'],
      category: 'technical',
      prompt: 'Explain React Fiber reconciliation.',
      answer_outline: 'Discuss phases, workLoop, priority levels.',
      difficulty: 2,
    },
    {
      id: 'q2',
      requirement_ids: ['r2'],
      category: 'system-design',
      prompt: 'Design a distributed rate limiter.',
      answer_outline: 'Discuss Token Bucket, Redis cluster, concurrency.',
      difficulty: 3,
    },
    {
      id: 'q3',
      requirement_ids: ['r3'],
      category: 'behavioural',
      prompt: 'Tell me about a time you mentored a junior engineer.',
      answer_outline: 'Situation, task, coaching actions, growth outcomes.',
      difficulty: 1,
    },
  ];

  it('allocates schedule for exactly 1 day', () => {
    const schedule = buildSchedule(sampleQuestions, sampleRequirements, 1);
    expect(schedule.days_available).toBe(1);
    expect(schedule.days.length).toBe(1);
    expect(schedule.days[0].day).toBe(1);
    expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
    expect(schedule.days[0].question_ids.length).toBeGreaterThanOrEqual(3);
  });

  it('allocates schedule for exactly 5 days', () => {
    const schedule = buildSchedule(sampleQuestions, sampleRequirements, 5);
    expect(schedule.days_available).toBe(5);
    expect(schedule.days.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(schedule.days[i].day).toBe(i + 1);
      expect(Number.isInteger(schedule.days[i].minutes)).toBe(true);
      expect(schedule.days[i].question_ids.length).toBeGreaterThan(0);
    }
  });

  it('allocates schedule for exactly 60 days', () => {
    const schedule = buildSchedule(sampleQuestions, sampleRequirements, 60);
    expect(schedule.days_available).toBe(60);
    expect(schedule.days.length).toBe(60);
    expect(schedule.days[59].day).toBe(60);
    expect(Number.isInteger(schedule.days[59].minutes)).toBe(true);
  });

  it('schedules harder and must-have material earlier', () => {
    const schedule = buildSchedule(sampleQuestions, sampleRequirements, 5);
    // q2 has difficulty 3 and covers must requirement r2. It should land on Day 1.
    expect(schedule.days[0].question_ids).toContain('q2');
  });

  it('ensures all must-have requirements appear in the schedule', () => {
    const schedule = buildSchedule(sampleQuestions, sampleRequirements, 3);
    const scheduledQuestionIds = new Set(schedule.days.flatMap((d) => d.question_ids));
    const questionMap = new Map(sampleQuestions.map((q) => [q.id, q]));

    const scheduledReqIds = new Set<string>();
    for (const qId of scheduledQuestionIds) {
      const q = questionMap.get(qId);
      if (q) {
        q.requirement_ids.forEach((rId) => scheduledReqIds.add(rId));
      }
    }

    expect(scheduledReqIds.has('r1')).toBe(true);
    expect(scheduledReqIds.has('r2')).toBe(true);
  });
});
