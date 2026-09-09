import { generateStructured } from './geminiClient.js';
import { Requirement, Question } from './schema.js';
import { checkCoverage } from './coverage.js';
import {
  calibrateDifficulty,
  isBannedRepetitiveTemplate,
  isInterviewableRequirement,
  synthesizeDomainQuestion,
} from './questionGenerator.js';

interface RawGapQuestion {
  requirement_id: string;
  category: 'technical' | 'behavioural' | 'system-design' | 'company-fit';
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
}

const SYSTEM_INSTRUCTION = `You are an expert technical interviewer and instructional designer. Your task is to generate targeted interview questions covering must-have requirements that need coverage.

CRITICAL LINGUISTIC CONSTRAINTS:
1. Question Phrasing (\`prompt\`): Write in extremely simple, easy-to-understand English.
2. Answer Phrasing (\`answer_outline\`): Write using plain, non-native, international English. Use short sentences, basic vocabulary, and standard grammar. Strictly avoid idioms, regional slang, metaphors, or complex academic phrasing.
3. Every question must map to one of the provided gap requirement IDs.
4. Output strictly JSON:
{
  "questions": [
    {
      "requirement_id": "rX",
      "category": "technical" | "behavioural" | "system-design" | "company-fit",
      "prompt": "Simple English question text here...",
      "answer_outline": "• Plain, non-native English bullet points outlining the expected answer...",
      "difficulty": 1 | 2 | 3
    }
  ]
}`;

/**
 * Runs the second-pass loop to close coverage gaps on must-have requirements.
 */
export async function runCoveragePasses(
  requirements: Requirement[],
  initialQuestions: Question[],
  roleTitle: string,
  maxPasses = 2,
  seniority = 'Mid-Level',
  options?: { customApiKey?: string }
): Promise<{ questions: Question[]; passes: number; uncovered_requirement_ids: string[] }> {
  let passes = 1;
  let questions = [...initialQuestions];
  let report = checkCoverage(requirements, questions);

  while (report.has_must_gaps && passes < maxPasses) {
    passes++;
    const gapReqs = requirements.filter(
      (r) => report.uncovered_must_ids.includes(r.id) && isInterviewableRequirement(r)
    );
    if (gapReqs.length === 0) break;

    const gapList = gapReqs.map((r) => `${r.id} (${r.kind}): "${r.text}"`).join('\n');

    const prompt = `
INPUT:
Role: ${roleTitle} (${seniority})
Gap Requirements needing questions:
${gapList}

INSTRUCTIONS:
1. Generate exactly 1 question for EACH gap requirement above.
2. Write in extremely simple, easy-to-understand English.
3. Write answer outlines using plain, non-native, international English with short sentences and basic vocabulary.
4. Calibrate question difficulty to seniority: ${seniority}.
`;

    const mockFallback = (): { questions: RawGapQuestion[] } => {
      return {
        questions: gapReqs.map((req, idx) => {
          const cat = req.kind === 'behavioural' ? 'behavioural' : 'technical';
          const synthesized = synthesizeDomainQuestion(
            req.text,
            cat,
            roleTitle,
            'Company',
            seniority,
            idx
          );

          return {
            requirement_id: req.id,
            category: cat,
            prompt: synthesized.prompt,
            answer_outline: synthesized.answer_outline,
            difficulty: synthesized.difficulty,
          };
        }),
      };
    };

    const result = await generateStructured<{ questions: RawGapQuestion[] }>(
      prompt,
      SYSTEM_INSTRUCTION,
      mockFallback,
      options
    );

    const questionList: RawGapQuestion[] = Array.isArray(result)
      ? (result as any)
      : (result?.questions || []);

    let nextQIndex = questions.length + 1;
    for (const raw of questionList) {
      const validReqId = report.uncovered_must_ids.includes(raw.requirement_id)
        ? raw.requirement_id
        : gapReqs[0]?.id;

      if (validReqId) {
        let finalPrompt = raw.prompt;
        if (isBannedRepetitiveTemplate(finalPrompt)) {
          const matchedReq = gapReqs.find((r) => r.id === validReqId) || gapReqs[0];
          const skill = matchedReq ? matchedReq.text : roleTitle;
          finalPrompt = `What architectural trade-offs do you consider when designing systems around ${skill}?`;
        }

        questions.push({
          id: `q${nextQIndex++}`,
          requirement_ids: [validReqId],
          category: raw.category || 'technical',
          prompt: finalPrompt,
          answer_outline: raw.answer_outline || '• Key architectural principles\n• Trade-off analysis\n• Verification methods',
          difficulty: calibrateDifficulty(seniority, Number(raw.difficulty) || 2, nextQIndex),
        });
      }
    }

    // Re-check coverage deterministically
    report = checkCoverage(requirements, questions);
  }

  return {
    questions,
    passes,
    uncovered_requirement_ids: report.uncovered_must_ids,
  };
}
