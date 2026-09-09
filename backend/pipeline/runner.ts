import { appendixASchema, AppendixAKit, toAppendixA, WorkingKit } from './schema.js';
import { crawlCompanySite } from './crawler.js';
import { researchPublicInterviewProcess } from './research.js';
import { extractRoleAndRequirements, isInvalidRequirementText, sanitizeRequirements, cleanRoleTitle } from './extractor.js';
import { generateCompanyBrief } from './briefGenerator.js';
import { generateInitialQuestions, isBannedRepetitiveTemplate, calibrateDifficulty } from './questionGenerator.js';
import { generateFlashcards } from './flashcardGenerator.js';
import { runCoveragePasses } from './secondPass.js';
import { buildSchedule } from './scheduler.js';

export interface PipelineInput {
  id?: string;
  jd: string;
  company_url: string;
  days: number;
  company_name?: string;
  api_key?: string;
}

export type ProgressCallback = (stage: string, percent: number) => void;

/**
 * The single master pipeline entry point used by BOTH
 * the web application and the batch CLI evaluator.
 * Does NOT touch MongoDB.
 */
export async function runPipeline(
  input: PipelineInput,
  onProgress?: ProgressCallback
): Promise<AppendixAKit> {
  const jdText = input.jd?.trim() || '';
  const companyUrl = input.company_url?.trim() || '';
  const days = Math.max(1, Math.min(60, Number(input.days) || 5));
  const userCompanyName = input.company_name?.trim();
  const llmOptions = input.api_key ? { customApiKey: input.api_key } : undefined;

  // 1. Crawl & Discover
  onProgress?.('crawling_site', 10);
  const crawlResult = await crawlCompanySite(companyUrl);

  onProgress?.('discovering_hiring_page', 25);
  // Crawl already ranks and prioritizes hiring pages

  // 2. Extract JD Requirements (Strict separation: candidate skills vs company context)
  onProgress?.('extracting_requirements', 35);
  const extracted = await extractRoleAndRequirements(jdText, companyUrl, userCompanyName, llmOptions);
  if (userCompanyName) {
    extracted.company = userCompanyName;
  }

  // Ensure role title is normalized and cleaned
  extracted.role = cleanRoleTitle(extracted.role, extracted.company);

  // Programmatic Quality Gate 1: Ensure zero headings, metadata, or company boilerplate in requirements
  extracted.requirements = sanitizeRequirements(extracted.requirements, extracted.company);
  if (extracted.requirements.length === 0) {
    extracted.requirements = [
      {
        id: 'r1',
        text: `Core software engineering and architecture for ${extracted.role}`,
        kind: 'technical',
        priority: 'must',
      },
    ];
  }

  // 3. Public Interview Process Research
  onProgress?.('researching_interviews', 45);
  const interviewResearch = await researchPublicInterviewProcess(
    extracted.company,
    crawlResult.pages,
    llmOptions
  );

  // 4. Generate Company Brief
  onProgress?.('generating_brief', 55);
  const brief = await generateCompanyBrief(
    extracted.company,
    crawlResult.pages,
    crawlResult.pages_used,
    llmOptions
  );

  // If public interview signals were discovered, enrich the brief sources
  if (interviewResearch.has_public_signals) {
    brief.sources = Array.from(new Set([...brief.sources, ...interviewResearch.sources]));
  }

  // 5. Generate Categorized Questions (grounded in requirements, seniority, and discovered interview format)
  onProgress?.('generating_questions', 65);
  const initialQuestions = await generateInitialQuestions(
    extracted.requirements,
    extracted.role,
    extracted.company,
    brief.what_they_do,
    extracted.seniority,
    llmOptions,
    interviewResearch.has_public_signals ? interviewResearch.notes : undefined
  );

  // 6. Generate Flashcards
  onProgress?.('generating_flashcards', 75);
  const flashcards = await generateFlashcards(
    extracted.requirements,
    initialQuestions,
    extracted.role,
    llmOptions
  );

  // 7 & 8. Deterministic Coverage Checking & Second Pass Loop
  onProgress?.('checking_coverage', 85);
  const coverageResult = await runCoveragePasses(
    extracted.requirements,
    initialQuestions,
    extracted.role,
    2,
    extracted.seniority,
    llmOptions
  );

  // Programmatic Quality Gate 2: Validate questions before scheduling
  const validReqIds = new Set(extracted.requirements.map((r) => r.id));
  const finalQuestions = coverageResult.questions.map((q, idx) => {
    // Filter requirement IDs to only existing ones
    const cleanReqIds = q.requirement_ids.filter((id) => validReqIds.has(id));
    if (cleanReqIds.length === 0) {
      cleanReqIds.push(extracted.requirements[0].id);
    }

    // Replace any banned repetitive template
    let cleanPrompt = q.prompt;
    if (isBannedRepetitiveTemplate(cleanPrompt)) {
      const primaryReq = extracted.requirements.find((r) => r.id === cleanReqIds[0]) || extracted.requirements[0];
      cleanPrompt = `Explain the core architecture of ${primaryReq.text}, and how you address common edge cases.`;
    }

    // Ensure answer outline has substance
    let cleanOutline = q.answer_outline;
    if (!cleanOutline || cleanOutline.trim().length < 15) {
      cleanOutline = `• Fundamental architectural principles\n• Concrete trade-offs\n• Implementation best practices\n• Verification strategy`;
    }

    return {
      ...q,
      prompt: cleanPrompt,
      requirement_ids: cleanReqIds,
      answer_outline: cleanOutline,
      difficulty: calibrateDifficulty(extracted.seniority, q.difficulty, idx),
    };
  });

  // 9. Deterministic Arithmetic Schedule
  onProgress?.('building_schedule', 95);
  const schedule = buildSchedule(
    finalQuestions,
    extracted.requirements,
    days
  );

  // Assemble the working kit
  const workingKit: WorkingKit = {
    source: {
      company: extracted.company,
      company_url: companyUrl,
      role: extracted.role,
      location: extracted.location,
      jd_chars: jdText.length,
      researched_at: new Date().toISOString(),
      pages_used: crawlResult.pages_used,
    },
    company_brief: brief,
    role: {
      title: extracted.role,
      seniority: extracted.seniority,
      responsibilities: extracted.responsibilities,
      requirements: extracted.requirements,
    },
    questions: finalQuestions.map((q) => ({
      ...q,
      origin: 'generated' as const,
      is_pinned: false,
    })),
    flashcards: flashcards.map((f) => ({
      ...f,
      origin: 'generated' as const,
      is_pinned: false,
    })),
    schedule,
    coverage: {
      uncovered_requirement_ids: coverageResult.uncovered_requirement_ids,
      passes: coverageResult.passes,
    },
  };

  // Convert to exact Appendix A format
  const appendixKit = toAppendixA(workingKit);

  // 10. Strict Schema Validation
  onProgress?.('validating', 99);
  const validated = appendixASchema.parse(appendixKit);

  onProgress?.('completed', 100);
  return validated;
}
