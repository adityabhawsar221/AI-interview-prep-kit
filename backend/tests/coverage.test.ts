import { describe, it, expect } from 'vitest';
import { checkCoverage } from '../pipeline/coverage.js';
import { runCoveragePasses } from '../pipeline/secondPass.js';
import { Requirement, Question } from '../pipeline/schema.js';

describe('Deterministic Coverage Checker & Loop', () => {
  const requirements: Requirement[] = [
    { id: 'r1', text: 'Proficiency with Node.js', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Database architecture (MongoDB)', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Docker experience', kind: 'technical', priority: 'nice' },
  ];

  it('correctly detects uncovered must-have requirements', () => {
    // Only r1 is covered
    const questions: Question[] = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'How does the Node event loop work?',
        answer_outline: 'Explain phases and libuv.',
        difficulty: 2,
      },
    ];

    const report = checkCoverage(requirements, questions);
    expect(report.has_must_gaps).toBe(true);
    expect(report.uncovered_must_ids).toContain('r2');
    expect(report.uncovered_must_ids).not.toContain('r1');
    // r3 is nice, so it should be in uncovered_all_ids, but not in uncovered_must_ids
    expect(report.uncovered_all_ids).toContain('r3');
    expect(report.uncovered_must_ids).not.toContain('r3');
  });

  it('runs second pass to replenish missing must-have questions', async () => {
    const initialQuestions: Question[] = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Node event loop?',
        answer_outline: 'Phases.',
        difficulty: 2,
      },
    ];

    const result = await runCoveragePasses(requirements, initialQuestions, 'Backend Engineer', 2);

    expect(result.passes).toBe(2);
    // After second pass, r2 should now be covered
    expect(result.uncovered_requirement_ids.length).toBe(0);
    expect(result.questions.length).toBeGreaterThan(initialQuestions.length);
  });
});
