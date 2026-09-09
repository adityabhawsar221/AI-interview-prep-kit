import { describe, it, expect } from 'vitest';
import { isInvalidRequirementText, sanitizeRequirements, extractRoleAndRequirements } from '../pipeline/extractor.js';
import { isBannedRepetitiveTemplate, calibrateDifficulty, generateInitialQuestions } from '../pipeline/questionGenerator.js';
import { runCoveragePasses } from '../pipeline/secondPass.js';
import { Requirement } from '../pipeline/schema.js';

describe('Quality Assurance & Anti-Hallucination Pipeline Gates', () => {
  describe('Non-Requirement Filter (isInvalidRequirementText)', () => {
    it('identifies and rejects section headings', () => {
      expect(isInvalidRequirementText("What You'll Do")).toBe(true);
      expect(isInvalidRequirementText("What We're Looking For")).toBe(true);
      expect(isInvalidRequirementText('Our Mission')).toBe(true);
      expect(isInvalidRequirementText('Work Style & Expectations')).toBe(true);
      expect(isInvalidRequirementText('Tech Stack (You Must Be Strong Here)')).toBe(true);
      expect(isInvalidRequirementText('About Us')).toBe(true);
      expect(isInvalidRequirementText('Qualifications:')).toBe(true);
      expect(isInvalidRequirementText('Responsibilities')).toBe(true);
    });

    it('identifies and rejects employment metadata and work arrangements', () => {
      expect(isInvalidRequirementText('Full-time')).toBe(true);
      expect(isInvalidRequirementText('Fully remote')).toBe(true);
      expect(isInvalidRequirementText('days a week, 9 hours/day')).toBe(true);
      expect(isInvalidRequirementText('40 hours a week')).toBe(true);
      expect(isInvalidRequirementText('Hybrid (San Francisco, CA)')).toBe(true);
      expect(isInvalidRequirementText('Contract')).toBe(true);
    });

    it('identifies and rejects slogans, compensation, and marketing statements', () => {
      expect(isInvalidRequirementText('Genuine love for coding')).toBe(true);
      expect(isInvalidRequirementText('$140k - $180k + equity')).toBe(true);
      expect(isInvalidRequirementText('Health insurance and 401k')).toBe(true);
      expect(isInvalidRequirementText('Fast-paced environment')).toBe(true);
      expect(isInvalidRequirementText('We are an equal opportunity employer')).toBe(true);
    });

    it('accepts legitimate technical and behavioral qualifications', () => {
      expect(isInvalidRequirementText('4+ years of professional experience with React and TypeScript')).toBe(false);
      expect(isInvalidRequirementText('Strong understanding of RESTful and GraphQL API design')).toBe(false);
      expect(isInvalidRequirementText('Hands-on experience with Docker and Kubernetes')).toBe(false);
      expect(isInvalidRequirementText('Experience mentoring junior engineers and conducting code reviews')).toBe(false);
      expect(isInvalidRequirementText('Deep expertise in DOM manipulation and CSS Flexbox')).toBe(false);
    });
  });

  describe('Requirement Sanitization', () => {
    it('sanitizes a messy list of raw items into clean requirements', () => {
      const raw = [
        { text: "What You'll Do" },
        { text: 'Full-time' },
        { text: 'Fully remote' },
        { text: 'Genuine love for coding' },
        { text: '4+ years of React and TypeScript experience' },
        { text: 'Tech Stack (You Must Be Strong Here)' },
        { text: 'REST API design and database optimization' },
        { text: 'Mentoring junior teammates' },
        { text: 'days a week, 9 hours/day' },
      ];

      const sanitized = sanitizeRequirements(raw);
      expect(sanitized.length).toBe(3);
      expect(sanitized.map((r) => r.text)).toContain('4+ years of React and TypeScript experience');
      expect(sanitized.map((r) => r.text)).toContain('REST API design and database optimization');
      expect(sanitized.map((r) => r.text)).toContain('Mentoring junior teammates');

      // Ensure stable sequential IDs
      expect(sanitized[0].id).toBe('r1');
      expect(sanitized[1].id).toBe('r2');
      expect(sanitized[2].id).toBe('r3');
    });
  });

  describe('Repetitive Template Detection & Elimination', () => {
    it('detects the banned boilerplate template', () => {
      expect(
        isBannedRepetitiveTemplate(
          'How have you applied React to solve critical challenges or optimize performance in production?'
        )
      ).toBe(true);
      expect(
        isBannedRepetitiveTemplate(
          'Explain how you applied Docker to solve critical challenges or optimize performance in production?'
        )
      ).toBe(true);
    });

    it('allows diverse, high-quality question archetypes', () => {
      expect(
        isBannedRepetitiveTemplate(
          'What is the difference between optimistic and pessimistic concurrency in PostgreSQL?'
        )
      ).toBe(false);
      expect(
        isBannedRepetitiveTemplate(
          'How would you diagnose a memory leak in a Node.js microservice handling 5k req/sec?'
        )
      ).toBe(false);
      expect(
        isBannedRepetitiveTemplate(
          'Tell me about a time you had a strong technical disagreement with a colleague. How was it resolved?'
        )
      ).toBe(false);
    });
  });

  describe('Seniority Difficulty Calibration', () => {
    it('calibrates junior roles to mostly 1–2', () => {
      for (let i = 0; i < 6; i++) {
        const diff = calibrateDifficulty('Junior Frontend Engineer', 2, i);
        expect(diff).toBeLessThanOrEqual(2);
      }
    });

    it('calibrates senior roles to mostly 2–3', () => {
      const diffs: number[] = [];
      for (let i = 0; i < 6; i++) {
        diffs.push(calibrateDifficulty('Senior Staff Architect', 2, i));
      }
      expect(diffs).toContain(2);
      expect(diffs).toContain(3);
      expect(diffs.filter((d) => d >= 2).length).toBe(6);
    });
  });

  describe('Full Extraction & Generation Integration', () => {
    const messyJD = `
Company: Stripe
Role: Senior Frontend Engineer
Location: Fully remote
Employment: Full-time, 5 days a week, 9 hours/day
Salary: $150,000 - $200,000 + Equity

Our Mission:
We are on a mission to increase the GDP of the internet. Genuine love for coding required.

What You'll Do:
- Architect reliable, accessible UI components for millions of users.
- Mentor junior engineers and champion clean code standards.

Tech Stack (You Must Be Strong Here):
- Modern React, TypeScript, and state management.
- Web performance optimization and DOM profiling.
- REST and GraphQL integration.
`;

    it('extracts only legitimate requirements from messy JD', async () => {
      const extracted = await extractRoleAndRequirements(messyJD, 'https://stripe.com', 'Stripe');

      // Verify no headings or metadata became requirements
      for (const req of extracted.requirements) {
        expect(isInvalidRequirementText(req.text)).toBe(false);
      }

      // Assert extracted requirements contain actual skills
      const allText = extracted.requirements.map((r) => r.text).join(' ');
      expect(allText).not.toContain("What You'll Do");
      expect(allText).not.toContain("Our Mission");
      expect(allText).not.toContain("Full-time");
      expect(allText).not.toContain("days a week");
      expect(allText).not.toContain("Genuine love for coding");
    });

    it('generates questions with zero banned templates and valid answer outlines', async () => {
      const requirements: Requirement[] = [
        { id: 'r1', text: 'Modern React and TypeScript development', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'Web performance optimization and DOM profiling', kind: 'technical', priority: 'must' },
        { id: 'r3', text: 'Mentoring junior engineers and code reviews', kind: 'behavioural', priority: 'must' },
      ];

      const questions = await generateInitialQuestions(
        requirements,
        'Senior Frontend Engineer',
        'Stripe',
        'Stripe builds global economic infrastructure.',
        'Senior'
      );

      expect(questions.length).toBeGreaterThanOrEqual(4);

      const categories = new Set(questions.map((q) => q.category));
      expect(categories.has('technical')).toBe(true);
      expect(categories.has('behavioural')).toBe(true);
      expect(categories.has('system-design')).toBe(true);
      expect(categories.has('company-fit')).toBe(true);

      for (const q of questions) {
        // Zero banned repetitive templates
        expect(isBannedRepetitiveTemplate(q.prompt)).toBe(false);
        // Requirement IDs must be valid
        expect(q.requirement_ids.length).toBeGreaterThan(0);
        expect(['r1', 'r2', 'r3']).toContain(q.requirement_ids[0]);
        // Answer outline must have substance
        expect(q.answer_outline.length).toBeGreaterThan(20);
        expect(q.answer_outline).toContain('•');
      }
    });

    it('generates flashcards with concept front and plain-English back', async () => {
      const { generateFlashcards } = await import('../pipeline/flashcardGenerator.js');
      const requirements: Requirement[] = [
        { id: 'r1', text: 'Modern React and TypeScript development', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'Web performance optimization and DOM profiling', kind: 'technical', priority: 'must' },
      ];

      const cards = await generateFlashcards(requirements, [], 'Senior Frontend Engineer');
      expect(cards.length).toBeGreaterThan(0);

      for (const card of cards) {
        expect(card.front.length).toBeGreaterThan(3);
        expect(card.back.length).toBeGreaterThan(15);
        expect(card.requirement_ids.length).toBeGreaterThan(0);
      }
    });
  });
});
