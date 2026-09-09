import { generateStructured } from './geminiClient.js';
import { Requirement, Question, Flashcard } from './schema.js';

interface RawFlashcard {
  front: string;
  back: string;
  requirement_ids: string[];
}

const SYSTEM_INSTRUCTION = `You are an expert technical interviewer and instructional designer. Your task is to generate realistic study flashcards for a candidate based strictly on the provided job requirements.

CRITICAL LINGUISTIC CONSTRAINTS:
1. Card Front (\`front\`): Short concept name or terminology.
2. Card Back (\`back\`): Write using plain, non-native, international English. Use short sentences, basic vocabulary, and standard grammar. Strictly avoid idioms, regional slang, metaphors, or complex academic phrasing.
3. Every card must reference at least one valid requirement ID.
4. Output ONLY valid JSON:
{
  "flashcards": [
    {
      "front": "Short concept name or terminology...",
      "back": "Plain, non-native English definition...",
      "requirement_ids": ["r1"]
    }
  ]
}`;

export async function generateFlashcards(
  requirements: Requirement[],
  questions: Question[],
  roleTitle: string,
  options?: { customApiKey?: string }
): Promise<Flashcard[]> {
  const reqSummary = requirements.map((r) => `${r.id}: ${r.text}`).join('\n');
  const validIds = new Set(requirements.map((r) => r.id));

  const prompt = `
INPUT:
Role: ${roleTitle}
Requirements:
${reqSummary}

INSTRUCTIONS:
1. Generate 4 to 6 study flashcards covering the core concepts from the requirements above.
2. Card front must be a short concept name or terminology.
3. Card back must be a plain, non-native English definition using short sentences and simple words.
4. Output ONLY valid JSON matching the expected schema.
`;

  const mockFallback = (): { flashcards: RawFlashcard[] } => {
    return {
      flashcards: requirements.slice(0, 4).map((r, idx) => {
        const conceptName = r.text.replace(/^(experience with|proficiency in|deep understanding of|knowledge of)\s+/i, '');
        return {
          front: conceptName,
          back: `${conceptName} is a technology or skill used to build software. It helps developers write reliable code, organize project files, and prevent system errors.`,
          requirement_ids: [r.id],
        };
      }),
    };
  };

  const response = await generateStructured<{ flashcards: RawFlashcard[] }>(
    prompt,
    SYSTEM_INSTRUCTION,
    mockFallback,
    options
  );

  return (response.flashcards || []).map((card, idx) => {
    const validReqIds = (card.requirement_ids || []).filter((id) => validIds.has(id));
    if (validReqIds.length === 0 && requirements.length > 0) {
      validReqIds.push(requirements[0].id);
    }

    return {
      id: `f${idx + 1}`,
      front: card.front,
      back: card.back,
      requirement_ids: validReqIds,
    };
  });
}
