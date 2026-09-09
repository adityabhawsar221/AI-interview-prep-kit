import { describe, it, expect } from 'vitest';
import {
  classifyRequirementItem,
  isInvalidRequirementText,
  cleanRoleTitle,
  sanitizeRequirements,
  extractRoleAndRequirements,
} from '../pipeline/extractor.js';
import {
  isInterviewableRequirement,
  generateInitialQuestions,
} from '../pipeline/questionGenerator.js';
import { runPipeline } from '../pipeline/runner.js';
import { checkCoverage } from '../pipeline/coverage.js';
import { Requirement } from '../pipeline/schema.js';

describe('Job Description Requirement Extraction & Context-Aware Classification', () => {
  describe('Mandatory Test Cases G.1 to G.9', () => {
    // 1. "Full-time Software Engineer" -> no requirement for full-time
    it('G.1: rejects "Full-time Software Engineer" as an interview requirement', () => {
      const result = classifyRequirementItem('Full-time Software Engineer');
      expect(result.is_interviewable).toBe(false);
      expect(result.category).toBe('job_metadata');
      expect(isInvalidRequirementText('Full-time Software Engineer')).toBe(true);
    });

    // 2. "Must be available for full-time employment" -> candidate requirement
    it('G.2: recognizes "Must be available for full-time employment" as a candidate requirement', () => {
      const result = classifyRequirementItem('Must be available for full-time employment');
      expect(result.is_interviewable).toBe(true);
      expect(result.category).toBe('candidate_eligibility');
      expect(isInvalidRequirementText('Must be available for full-time employment')).toBe(false);
    });

    // 3. "5+ years of React experience" -> technical requirement
    it('G.3: recognizes "5+ years of React experience" as a technical requirement', () => {
      const result = classifyRequirementItem('5+ years of React experience');
      expect(result.is_interviewable).toBe(true);
      expect(result.kind).toBe('technical');
      expect(isInvalidRequirementText('5+ years of React experience')).toBe(false);
    });

    // 4. "Mentor junior engineers" -> behavioural requirement
    it('G.4: recognizes "Mentor junior engineers" as a behavioural requirement', () => {
      const result = classifyRequirementItem('Mentor junior engineers');
      expect(result.is_interviewable).toBe(true);
      expect(result.kind).toBe('behavioural');
      expect(isInvalidRequirementText('Mentor junior engineers')).toBe(false);
    });

    // 5. "Benefits include health insurance" -> not a requirement
    it('G.5: rejects "Benefits include health insurance" as non-requirement', () => {
      const result = classifyRequirementItem('Benefits include health insurance');
      expect(result.is_interviewable).toBe(false);
      expect(result.category).toBe('compensation_benefits');
      expect(isInvalidRequirementText('Benefits include health insurance')).toBe(true);
    });

    // 6. "Remote position in Bangalore" -> not an interview question by default
    it('G.6: rejects "Remote position in Bangalore" as location/work arrangement metadata', () => {
      const result = classifyRequirementItem('Remote position in Bangalore');
      expect(result.is_interviewable).toBe(false);
      expect(result.category).toBe('job_metadata');
      expect(isInvalidRequirementText('Remote position in Bangalore')).toBe(true);
    });

    // 7. "Must be willing to relocate to Bangalore" -> candidate requirement
    it('G.7: recognizes "Must be willing to relocate to Bangalore" as an explicit candidate requirement', () => {
      const result = classifyRequirementItem('Must be willing to relocate to Bangalore');
      expect(result.is_interviewable).toBe(true);
      expect(result.category).toBe('candidate_eligibility');
      expect(isInvalidRequirementText('Must be willing to relocate to Bangalore')).toBe(false);
    });

    // 8. Generic company boilerplate -> ignored
    it('G.8: ignores generic company boilerplate and "About Us" statements', () => {
      const boilerplate1 =
        'Trao is an AI R&D lab for mid-market and enterprise companies. We research, design, build, and deploy software and AI systems.';
      const res1 = classifyRequirementItem(boilerplate1, { companyName: 'Trao' });
      expect(res1.is_interviewable).toBe(false);
      expect(res1.category).toBe('company_context');

      const boilerplate2 = 'We are an equal opportunity employer and celebrate diversity.';
      const res2 = classifyRequirementItem(boilerplate2);
      expect(res2.is_interviewable).toBe(false);

      const boilerplate3 = 'Join our fast-paced startup environment and rockstar engineering team.';
      const res3 = classifyRequirementItem(boilerplate3);
      expect(res3.is_interviewable).toBe(false);
    });

    // 9. Mixed JD containing metadata + real requirements -> only real requirements generate questions
    it('G.9: sanitizes mixed JD to keep ONLY real requirements', () => {
      const rawMixed = [
        { text: 'Role: Senior Backend Engineer' },
        { text: 'Employment Type: Full-time' },
        { text: 'Location: Bangalore' },
        { text: 'Benefits include health insurance and 401(k)' },
        { text: 'Trao is an AI R&D lab building smart systems' },
        { text: '5+ years of React experience' },
        { text: 'Deep expertise in Node.js and REST API architecture' },
        { text: 'Mentor junior engineers and lead architectural design' },
        { text: 'Remote position in Bangalore' },
        { text: 'Must be willing to relocate to Bangalore' },
        { text: 'Equal Opportunity Employer' },
      ];

      const sanitized = sanitizeRequirements(rawMixed, 'Trao');

      // Only real requirements survived
      const texts = sanitized.map((r) => r.text);
      expect(texts).toContain('5+ years of React experience');
      expect(texts).toContain('Deep expertise in Node.js and REST API architecture');
      expect(texts).toContain('Mentor junior engineers and lead architectural design');
      expect(texts).toContain('Must be willing to relocate to Bangalore');

      // None of the metadata or company boilerplate survived
      expect(texts).not.toContain('Employment Type: Full-time');
      expect(texts).not.toContain('Location: Bangalore');
      expect(texts).not.toContain('Benefits include health insurance and 401(k)');
      expect(texts).not.toContain('Trao is an AI R&D lab building smart systems');
      expect(texts).not.toContain('Remote position in Bangalore');
      expect(texts).not.toContain('Equal Opportunity Employer');

      // Requirements must have stable sequential IDs
      sanitized.forEach((r, idx) => {
        expect(r.id).toBe(`r${idx + 1}`);
      });
    });
  });

  describe('Role Title Normalization (cleanRoleTitle)', () => {
    it('cleans "role : software engineer" to "Software Engineer"', () => {
      expect(cleanRoleTitle('role : software engineer')).toBe('Software Engineer');
      expect(cleanRoleTitle('Role: Software Engineer')).toBe('Software Engineer');
      expect(cleanRoleTitle('ROLE : SOFTWARE ENGINEER')).toBe('Software Engineer');
    });

    it('cleans "Job Title: Senior Backend Developer"', () => {
      expect(cleanRoleTitle('Job Title: Senior Backend Developer')).toBe('Senior Backend Developer');
    });

    it('cleans markdown formatting from title', () => {
      expect(cleanRoleTitle('### Staff Architect')).toBe('Staff Architect');
      expect(cleanRoleTitle('**Lead Frontend Engineer**')).toBe('Lead Frontend Engineer');
    });

    it('strips company prefix when company name matches', () => {
      expect(cleanRoleTitle('TRAO - Software Engineer', 'TRAO')).toBe('Software Engineer');
      expect(cleanRoleTitle('Trao | Full Stack Developer', 'Trao')).toBe('Full Stack Developer');
    });
  });

  describe('Question Generation Guard (Safeguards C, D & E)', () => {
    it('isInterviewableRequirement returns false for metadata & boilerplate', () => {
      expect(isInterviewableRequirement({ id: 'r1', text: 'Full-time', kind: 'technical', priority: 'must' })).toBe(
        false
      );
      expect(
        isInterviewableRequirement({
          id: 'r2',
          text: 'Employment Type: Full-time',
          kind: 'technical',
          priority: 'must',
        })
      ).toBe(false);
      expect(
        isInterviewableRequirement({
          id: 'r3',
          text: 'Location: Bangalore',
          kind: 'technical',
          priority: 'must',
        })
      ).toBe(false);
      expect(
        isInterviewableRequirement({
          id: 'r4',
          text: 'Benefits include health insurance',
          kind: 'technical',
          priority: 'must',
        })
      ).toBe(false);
      expect(
        isInterviewableRequirement(
          {
            id: 'r5',
            text: 'Trao is an AI R&D lab for mid-market and enterprise companies.',
            kind: 'technical',
            priority: 'must',
          },
          'Trao'
        )
      ).toBe(false);
    });

    it('isInterviewableRequirement returns true for genuine candidate requirements', () => {
      expect(
        isInterviewableRequirement({
          id: 'r1',
          text: '4+ years of React and TypeScript experience',
          kind: 'technical',
          priority: 'must',
        })
      ).toBe(true);
      expect(
        isInterviewableRequirement({
          id: 'r2',
          text: 'Mentoring junior developers and conducting reviews',
          kind: 'behavioural',
          priority: 'must',
        })
      ).toBe(true);
      expect(
        isInterviewableRequirement({
          id: 'r3',
          text: 'Must be available for full-time employment',
          kind: 'behavioural',
          priority: 'must',
        })
      ).toBe(true);
    });

    it('generateInitialQuestions never creates questions for metadata items', async () => {
      const mixedRequirements: Requirement[] = [
        { id: 'r1', text: 'Employment Type: Full-time', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'Trao is an AI R&D lab', kind: 'technical', priority: 'must' },
        { id: 'r3', text: 'React and Node.js REST API development', kind: 'technical', priority: 'must' },
      ];

      const questions = await generateInitialQuestions(
        mixedRequirements,
        'Software Engineer',
        'Trao',
        'Trao builds enterprise software.',
        'Mid-Level'
      );

      expect(questions.length).toBeGreaterThanOrEqual(4);

      // Questions must ONLY target r3 (the interviewable requirement)
      for (const q of questions) {
        expect(q.prompt).not.toContain('Employment Type: Full-time');
        expect(q.prompt).not.toContain('Trao is an AI R&D lab');
        expect(q.requirement_ids).toContain('r3');
        expect(q.requirement_ids).not.toContain('r1');
        expect(q.requirement_ids).not.toContain('r2');
      }
    });

    it('coverage checker does not count metadata as uncovered requirements', () => {
      // Role requirements must contain only interviewable items
      const requirements: Requirement[] = [
        { id: 'r1', text: '5+ years of React experience', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'Node.js and REST APIs', kind: 'technical', priority: 'must' },
      ];

      const questions = [
        {
          id: 'q1',
          requirement_ids: ['r1', 'r2'],
          category: 'technical' as const,
          prompt: 'How do you optimize React performance with Node.js APIs?',
          answer_outline: '• Memoization\n• SSR\n• Caching',
          difficulty: 2 as const,
        },
      ];

      const report = checkCoverage(requirements, questions);
      expect(report.has_must_gaps).toBe(false);
      expect(report.uncovered_must_ids).toHaveLength(0);
      expect(report.coverage_percentage).toBe(100);
    });
  });

  describe('Realistic End-to-End Pipeline Verification', () => {
    it('handles the user reported Bangalore / Full-time JD scenario', async () => {
      const jd = `
Software Engineer
Employment Type: Full-time
Location: Bangalore
We are looking for someone with experience in React, Node.js and REST APIs.
`;

      const result = await runPipeline({
        jd,
        company_url: 'https://example.com',
        days: 5,
        company_name: 'TechCorp',
      });

      // Role must be clean
      expect(result.role.title).toBe('Software Engineer');

      // Zero requirements for "Full-time" or "Bangalore"
      const reqTexts = result.role.requirements.map((r) => r.text.toLowerCase());
      for (const t of reqTexts) {
        expect(t).not.toBe('full-time');
        expect(t).not.toContain('employment type');
        expect(t).not.toBe('bangalore');
        expect(t).not.toContain('location:');
      }

      // Valid requirement extracted
      const joinedReqs = result.role.requirements.map((r) => r.text).join(' ');
      expect(joinedReqs).toMatch(/react|node|api/i);

      // Zero questions generated for "Full-time"
      for (const q of result.questions) {
        expect(q.prompt.toLowerCase()).not.toContain('what is full-time');
        expect(q.prompt.toLowerCase()).not.toContain('employment type');
      }
    }, 60000);

    it('handles the user reported TRAO company description scenario', async () => {
      const jd = `
role : software engineer
Trao is an AI R&D lab for mid-market and enterprise companies. We research, design, build, and deploy software and AI systems.
`;

      const result = await runPipeline({
        jd,
        company_url: 'https://trao.ai',
        days: 7,
        company_name: 'TRAO',
      });

      // Role must be normalized to "Software Engineer", NOT "role : software engineer"
      expect(result.role.title).toBe('Software Engineer');
      expect(result.role.title).not.toContain('role :');

      // Company description must NOT be extracted as a requirement
      for (const req of result.role.requirements) {
        expect(req.text).not.toContain('Trao is an AI R&D lab');
        expect(req.text).not.toContain('We research, design, build');
      }

      // Questions must NOT ask "What is Trao is an AI R&D lab..."
      for (const q of result.questions) {
        expect(q.prompt).not.toContain('What is Trao is an AI R&D lab');
        expect(q.prompt).not.toContain('What is Trao');
      }
    }, 60000);

    it('handles the user reported FULL Trao Job Description scenario with MERN, AI agents, and DevOps', async () => {
      const fullTraoJd = `
Our Mission
To change how organizations do work.

Trao is an AI R&D lab for mid-market and enterprise companies. We research, design, build, and deploy software and AI systems.

We've delivered work across industries, including:

Large banks such as CommBank (one of Australia's largest banks)
The UK Government
US-based family offices
Numerous VC-backed startups
Behind the scenes is a team obsessed with over-delivering extremely high-quality work every single day. We are engineering-first, detail-oriented, and focused on solving real business problems through automation that most teams would consider impossible.

We work on very ambitious projects.

Work Style & Expectations
6 days a week, 9 hours/day
Fully remote
More often than not, you will work beyond 9 hours
Fast timelines, real deadlines, real ownership
Daily collaboration with a small, strong team of engineers solving complex problems
If you are NOT deeply passionate about coding and systems, this role will not be a good fit.

What You'll Do
Build and ship production-grade MERN systems
Architect multi-agent AI workflows (orchestration, memory, tools)
Own DevOps and infrastructure: deployments, CI/CD, monitoring
Design scalable APIs, async pipelines, and clear system boundaries
Debug production issues under pressure
Make and own architectural decisions
Tech Stack (You Must Be Strong Here)
MERN stack
Typescript
AI / Agents: LangChain, LangGraph, CrewAI, custom orchestration
DevOps: Docker, CI/CD pipelines, AWS / GCP / DigitalOcean
What We're Looking For
Genuine love for coding
Experience shipping real production systems
Strong systems thinker with solid engineering fundamentals
Comfortable owning infrastructure and deployments
High ownership, high stamina, high standards
`;

      const result = await runPipeline({
        jd: fullTraoJd,
        company_url: 'https://trao.ai',
        days: 7,
        company_name: 'TRAO',
      });

      // 1. Role title
      expect(result.role.title).toBe('Software Engineer');

      // 2. Zero metadata or company boilerplate requirements
      const reqTexts = result.role.requirements.map((r) => r.text);
      for (const text of reqTexts) {
        expect(text).not.toContain('Fully remote');
        expect(text).not.toContain('Full-time');
        expect(text).not.toContain('6 days a week');
        expect(text).not.toContain('Trao is an AI R&D lab');
        expect(text).not.toContain('To change how organizations do work');
        expect(text).not.toContain('Genuine love for coding');
        expect(text).not.toContain('High ownership');
      }

      // 3. Must have MERN, TypeScript, AI agents, DevOps
      const allReqs = reqTexts.join(' ');
      expect(allReqs).toMatch(/mern/i);
      expect(allReqs).toMatch(/typescript/i);
      expect(allReqs).toMatch(/ai|agent/i);
      expect(allReqs).toMatch(/docker|devops/i);

      // 4. Questions must NEVER be repetitive "Software Engineer engineering fundamentals"
      const prompts = result.questions.map((q) => q.prompt);
      const seCount = prompts.filter((p) => p.includes('Software Engineer engineering fundamentals')).length;
      expect(seCount).toBe(0);

      // 5. Zero questions on "Fully remote" or "Full-time"
      for (const p of prompts) {
        expect(p.toLowerCase()).not.toContain('fully remote');
        expect(p.toLowerCase()).not.toContain('full-time');
      }

      // 6. Must contain deep technical questions on MERN, TypeScript, or AI workflows
      const allPrompts = prompts.join(' ');
      expect(allPrompts).toMatch(/mern|mongodb|react/i);
      expect(allPrompts).toMatch(/typescript|type|interface/i);
    }, 60000);

    it('dynamically handles a Java / Spring Boot / Kafka / PostgreSQL JD without hardcoding or MERN leakage', async () => {
      const javaJd = `
Role: Senior Java Backend Engineer
Company: FintechCorp
Location: London, UK
Employment Type: Full-time

About Us
FintechCorp is a global digital banking platform powering millions of daily transactions.

Responsibilities:
- Build high-throughput event-driven microservices using Java 17 and Spring Boot.
- Design relational schemas and optimize complex SQL queries in PostgreSQL.
- Implement distributed event streaming architectures with Apache Kafka.
- Own Kubernetes deployments and cloud infrastructure on AWS.

Requirements:
- 5+ years of experience with Java and Spring Boot microservices
- Deep knowledge of Hibernate, JPA, and PostgreSQL database optimization
- Proven experience with Apache Kafka and distributed event messaging
- Strong understanding of Kubernetes, Docker, and AWS cloud environments
- Experience with unit and integration testing using JUnit and Mockito
`;

      const result = await runPipeline({
        jd: javaJd,
        company_url: 'https://fintechcorp.example.com',
        days: 5,
        company_name: 'FintechCorp',
      });

      expect(result.role.title).toBe('Senior Java Backend Engineer');

      // Check extracted requirements
      const reqTexts = result.role.requirements.map((r) => r.text);
      const joinedReqs = reqTexts.join(' ');
      expect(joinedReqs).toMatch(/java/i);
      expect(joinedReqs).toMatch(/spring/i);
      expect(joinedReqs).toMatch(/kafka/i);
      expect(joinedReqs).toMatch(/postgresql/i);

      // Verify ZERO MERN leakage
      expect(joinedReqs.toLowerCase()).not.toContain('mern');
      expect(joinedReqs.toLowerCase()).not.toContain('mongodb');

      // Check generated questions
      const prompts = result.questions.map((q) => q.prompt);
      const allPrompts = prompts.join(' ');
      expect(allPrompts).toMatch(/java|spring|hibernate|kafka|postgres/i);
      expect(allPrompts.toLowerCase()).not.toContain('mern');
      expect(allPrompts.toLowerCase()).not.toContain('mongodb');
    }, 60000);
  });
});
