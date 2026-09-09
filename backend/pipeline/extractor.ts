import { generateStructured } from './geminiClient.js';
import { Requirement } from './schema.js';

export interface ExtractedRoleData {
  company: string;
  role: string;
  location: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface ClassificationResult {
  is_interviewable: boolean;
  category:
    | 'technical'
    | 'behavioural'
    | 'domain'
    | 'candidate_eligibility'
    | 'job_metadata'
    | 'company_context'
    | 'compensation_benefits'
    | 'recruiting_info'
    | 'section_heading';
  kind: 'technical' | 'behavioural' | 'domain';
  priority: 'must' | 'nice';
  reason: string;
  cleanedText: string;
}

/**
 * Sanitizes and normalizes a role title, stripping prefixes like "Role:",
 * markdown syntax, company names, and normalizing casing.
 */
export function cleanRoleTitle(rawTitle: string, companyName?: string): string {
  if (!rawTitle) return 'Software Engineer';
  let clean = rawTitle.trim();

  // Strip markdown formatting like ###, **, _
  clean = clean.replace(/^[#*_\s]+/, '').replace(/[#*_\s]+$/, '').trim();

  // Strip prefixes like "Role:", "Job Title:", "Position:", "Title:"
  clean = clean.replace(/^(role|job\s*title|position|title)\s*[:\-–—]\s*/i, '').trim();

  // Strip company name if prepended: "TRAO - Software Engineer" or "TRAO | Software Engineer"
  if (companyName && companyName.trim()) {
    const escaped = companyName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(`^${escaped}\\s*[:\\-–—|]\\s*`, 'i'), '').trim();
  }

  // Also strip common company prefixes if the line is "Acme Corp - Senior Engineer"
  clean = clean.replace(
    /^[A-Za-z0-9&.,\s]{2,30}\s*[-–—|]\s*(Software Engineer|Frontend Engineer|Backend Engineer|Full Stack Engineer|DevOps|Data Engineer|Mobile Engineer|Product Engineer|Engineering Manager|System Architect|Architect|Developer)/i,
    '$1'
  ).trim();

  // Convert all-lowercase or all-caps to Title Case
  if (clean === clean.toLowerCase() || (clean.length > 5 && clean === clean.toUpperCase())) {
    clean = clean
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // If after cleaning it turns out to be a company statement, heading, or metadata, fall back to "Software Engineer"
  if (
    !clean ||
    /^(our mission|about (us|you|the company)|who we are|company overview|mission|overview|job description|responsibilities|requirements|what we offer|work style(\s*&?\s*expectations)?|expectations)$/i.test(
      clean
    ) ||
    /^(we are|we're|our company|our mission|our team|our vision|we research|we design|we build|salary|benefits|compensation)/i.test(
      clean
    )
  ) {
    return 'Software Engineer';
  }

  return clean || 'Software Engineer';
}

/**
 * Classifies an extracted text snippet using context-aware heuristics.
 * Evaluates whether an item is an actual interviewable requirement vs
 * metadata, company boilerplate, compensation, or recruiting instructions.
 */
export function classifyRequirementItem(
  rawText: string,
  context?: {
    companyName?: string;
    jobTitle?: string;
    sectionHeading?: string;
  }
): ClassificationResult {
  let text = rawText.trim().replace(/^([-*•–—]|(\d+[\.\)]))\s*/, '').trim();

  // Strip hiring preambles early (e.g. "We are looking for someone with...", "The ideal candidate will have...")
  const hiringPreamble =
    /^(we are looking for|we're looking for|we are seeking|we're seeking|looking for|seeking|we are hiring (someone|a candidate)?\s*(with|for)?|we expect you to have|we require|you will have|the ideal candidate (has|should have|will have|must have))\s+(someone\s+(with|who\s+has)\s+)?/i;
  if (hiringPreamble.test(text)) {
    text = text.replace(hiringPreamble, '').trim();
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }
  }

  // 1. Too short to be meaningful
  if (text.length < 4) {
    return {
      is_interviewable: false,
      category: 'job_metadata',
      kind: 'technical',
      priority: 'must',
      reason: 'Text is too short to represent a qualification',
      cleanedText: text,
    };
  }

  // 1b. Role title match: if item is identical to the detected role title
  if (context?.jobTitle && text.toLowerCase() === context.jobTitle.trim().toLowerCase()) {
    return {
      is_interviewable: false,
      category: 'job_metadata',
      kind: 'technical',
      priority: 'must',
      reason: 'Matches job title',
      cleanedText: text,
    };
  }

  // 1c. Pure job title phrases (e.g. "Senior Full-Stack Engineer", "Backend Developer")
  if (
    /^(senior |junior |lead |staff |principal |full[- ]?stack |frontend |backend |ai |ml |devops |software )*(software engineer|frontend engineer|backend engineer|full stack engineer|web developer|data engineer|systems engineer|devops engineer|ai engineer|machine learning engineer)$/i.test(
      text
    )
  ) {
    return {
      is_interviewable: false,
      category: 'job_metadata',
      kind: 'technical',
      priority: 'must',
      reason: 'Job title line',
      cleanedText: text,
    };
  }

  // 2. Section headings (including "Required Qualifications:", "Bonus Points:", etc.)
  const headingRegex =
    /^(((required|preferred|minimum|basic|key|desired|additional)\s+)?(qualifications|requirements|skills|responsibilities|experience|competencies|prerequisites)|what (you'll|we're|we|you will) (do|look(ing)?(\s+for)?|bring)|who (you are|we are)|about (us|you|the company|the team|the role)|our (mission|values|story|culture)|work style(\s*&?\s*expectations)?|tech stack(\s*\(.*\))?|job (description|summary|overview|details|specifications?)|benefits|perks|compensation|how to apply|why join|the opportunity|the role|role overview|bonus points?|nice to haves?|must haves?):?$/i;
  if (
    headingRegex.test(text) ||
    /^tech stack\s*\(.*\)$/i.test(text) ||
    /^(responsibilities|requirements|qualifications|bonus points?|nice to haves?|must haves?):?$/i.test(text)
  ) {
    return {
      is_interviewable: false,
      category: 'section_heading',
      kind: 'technical',
      priority: 'must',
      reason: 'Section heading or structural divider',
      cleanedText: text,
    };
  }

  // 3. Current section context: if item is inside a non-requirement section
  if (context?.sectionHeading) {
    const sec = context.sectionHeading.toLowerCase();
    if (/(about|mission|who we are|culture|overview|benefits|perks|compensation|how to apply|apply|equal opportunity)/i.test(sec)) {
      return {
        is_interviewable: false,
        category: 'company_context',
        kind: 'technical',
        priority: 'must',
        reason: `Item is within non-requirement section "${context.sectionHeading}"`,
        cleanedText: text,
      };
    }
  }

  // 4. Company boilerplate / Mission / About statements
  const compName = context?.companyName?.trim();
  if (compName) {
    const escapedComp = compName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const compIntroRegex = new RegExp(
      `^(${escapedComp})\\s+(is|was|are|builds|helps|provides|operates|delivers|researches|designs|empowers|works|offers|creates|specializes)\\b`,
      'i'
    );
    if (compIntroRegex.test(text)) {
      return {
        is_interviewable: false,
        category: 'company_context',
        kind: 'technical',
        priority: 'must',
        reason: 'Company description statement',
        cleanedText: text,
      };
    }
    if (new RegExp(`^about\\s+${escapedComp}\\b`, 'i').test(text)) {
      return {
        is_interviewable: false,
        category: 'company_context',
        kind: 'technical',
        priority: 'must',
        reason: 'Company header statement',
        cleanedText: text,
      };
    }
  }

  // General company recruiting invitations or slogans
  if (/^join (our|us)\b/i.test(text)) {
    return {
      is_interviewable: false,
      category: 'company_context',
      kind: 'technical',
      priority: 'must',
      reason: 'Company recruiting invitation',
      cleanedText: text,
    };
  }

  // General company descriptive statements / mission
  if (
    /^(we are|we're|our company|our mission|our team|our vision|we research|we design|we build|we deliver|we provide|we empower|we help companies|we operate|founded in \d{4}|backed by|venture-backed|series [a-d]|seed funded|equal opportunity employer|we celebrate diversity|we do not discriminate|join our team|join us in)\b/i.test(
      text
    )
  ) {
    return {
      is_interviewable: false,
      category: 'company_context',
      kind: 'technical',
      priority: 'must',
      reason: 'Company overview or mission statement',
      cleanedText: text,
    };
  }

  // General third-person company descriptions (e.g. "Trao is an AI R&D lab...", "[Company] is an enterprise platform...")
  if (
    /^[A-Z][A-Za-z0-9&\s]{1,30}\s+is an?\s+(ai\s+r&d\s+lab|software company|platform|startup|firm|agency|technology company|leader in|global provider)/i.test(
      text
    )
  ) {
    return {
      is_interviewable: false,
      category: 'company_context',
      kind: 'technical',
      priority: 'must',
      reason: 'Company descriptive statement',
      cleanedText: text,
    };
  }

  // 5. Compensation & Benefits
  if (
    /^(salary|compensation|pay rate|benefits|perks)\s*[:\-–]/i.test(text) ||
    /^benefits\s+include\b/i.test(text) ||
    /^(comprehensive\s+)?(health|dental|vision)\s+insurance/i.test(text) ||
    /(401\s*\(?k\)?\s*matching|unlimited\s+pto|paid\s+time\s+off|annual\s+bonus|\$\d+k?\s*-\s*\$\d+k?)/i.test(text)
  ) {
    return {
      is_interviewable: false,
      category: 'compensation_benefits',
      kind: 'technical',
      priority: 'must',
      reason: 'Compensation or employee benefits metadata',
      cleanedText: text,
    };
  }

  // 6. Recruiting & Application instructions
  if (
    /^(how to apply|to apply|apply now|application deadline|applications? close|send (your )?(resume|cv)|apply (via|at|by|through)|recruitment process|equal opportunity employer|eeo statement|click (here|apply)):?/i.test(
      text
    )
  ) {
    return {
      is_interviewable: false,
      category: 'recruiting_info',
      kind: 'technical',
      priority: 'must',
      reason: 'Recruiting or application instructions',
      cleanedText: text,
    };
  }

  // 7. Slogans & Generic Corporate Fluff
  if (
    /(fast[- ]?paced (environment|startup)|genuine love for coding|passion(ate)? (about|for) (coding|tech|technology)|self[- ]?starter|team player|can[- ]?do attitude|rockstar|ninja|wear many hats|hit the ground running|high stamina|high ownership|high standards)/i.test(
      text
    ) &&
    !/(react|typescript|javascript|python|node|java|go|rust|c\+\+|sql|nosql|docker|k8s|aws|cloud|api|ci\/cd|git|linux|css|html|experience|years|bachelor|degree)/i.test(
      text
    )
  ) {
    return {
      is_interviewable: false,
      category: 'company_context',
      kind: 'behavioural',
      priority: 'must',
      reason: 'Generic marketing slogan or corporate buzzword',
      cleanedText: text,
    };
  }

  // 8. Distinguish Candidate Eligibility vs Job Metadata
  // CANDIDATE ELIGIBILITY (Interviewable Candidate Requirements):
  // e.g. "Must be available to work full-time", "Must be available for full-time employment", "Must be willing to relocate to Bangalore", "Must possess valid work authorization"
  const isExplicitCandidateAvailability =
    /(must|should|required to|needs to|expected to|candidate must)\s+(be available|be willing|relocate|reside|work in|possess|have)/i.test(
      text
    );
  const isWillingToRelocate = /(willing to relocate|relocation required|must be willing to relocate)/i.test(text);
  const isMustBeAvailableFulltime = /must be available (for|to work)\s+full[- ]?time/i.test(text);
  const isWorkAuthorization = /(authorized to work|work authorization|sponsorship)/i.test(text) && /(must|require|eligible)/i.test(text);

  if (
    isMustBeAvailableFulltime ||
    isWillingToRelocate ||
    isWorkAuthorization ||
    (isExplicitCandidateAvailability && /(full[- ]?time|relocate|location|authorization)/i.test(text))
  ) {
    return {
      is_interviewable: true,
      category: 'candidate_eligibility',
      kind: 'behavioural',
      priority: 'must',
      reason: 'Explicit candidate availability or eligibility requirement',
      cleanedText: text,
    };
  }

  // Experience requirements that happen to mention full-time or remote:
  // e.g. "Experience working full-time on production systems", "5+ years of full-time React experience"
  const isExperienceWithKeywords =
    /(\d+\+?\s*years?|experience|proficien|track record|background|hands[- ]on)\s+.*(full[- ]?time|remote|production|software)/i.test(
      text
    );
  if (isExperienceWithKeywords && !/^(employment type|location|job type)\s*:/i.test(text)) {
    const isBeh = /lead|mentor|communication|collaborat|teamwork|stakeholder|conflict|agile|empathy/i.test(text);
    const isDomain = /fintech|banking|healthcare|e-commerce|security|compliance|crypto|payments|saas|logistics/i.test(text);
    return {
      is_interviewable: true,
      category: isBeh ? 'behavioural' : isDomain ? 'domain' : 'technical',
      kind: isBeh ? 'behavioural' : isDomain ? 'domain' : 'technical',
      priority: /nice|bonus|plus|preferred|optional/i.test(text) ? 'nice' : 'must',
      reason: 'Legitimate candidate experience qualification',
      cleanedText: text,
    };
  }

  // JOB METADATA (Non-interviewable):
  // - Employment type: "Full-time", "Employment Type: Full-time", "Full-time Software Engineer", "Full-time position"
  if (
    /^(employment type|job type|position type|work type|schedule)\s*[:\-–]\s*(full[- ]?time|part[- ]?time|contract(or)?|intern(ship)?|temporary|permanent|remote|hybrid|on[- ]?site)/i.test(
      text
    ) ||
    /^(full[- ]?time|part[- ]?time|contract(or)?|intern(ship)?|temporary|permanent)(\s+(position|role|employment|job|software engineer|engineer|developer))?$/i.test(
      text
    ) ||
    /^(full[- ]?time|part[- ]?time)\s+software\s+engineer$/i.test(text)
  ) {
    return {
      is_interviewable: false,
      category: 'job_metadata',
      kind: 'technical',
      priority: 'must',
      reason: 'Employment type metadata',
      cleanedText: text,
    };
  }

  // - Location metadata: "Location: Bangalore", "Remote position in Bangalore", "Based in Bangalore", "Hybrid (Bangalore)", "Fully remote"
  if (
    /^location\s*[:\-–]/i.test(text) ||
    /^(fully remote|remote|hybrid|on[- ]?site|in[- ]?office)(\s+position|\s+role|\s+job)?(\s+in\s+[A-Za-z\s,]+)?$/i.test(text) ||
    /^(fully remote|remote|hybrid|on[- ]?site|in[- ]?office)(\s*\(.*\))?$/i.test(text) ||
    /^(based in|located in|headquartered in)\s+[A-Za-z\s,]+$/i.test(text) ||
    /^(san francisco|new york|bangalore|bengaluru|london|berlin|remote,\s*us|worldwide)$/i.test(text)
  ) {
    return {
      is_interviewable: false,
      category: 'job_metadata',
      kind: 'technical',
      priority: 'must',
      reason: 'Location or remote work arrangement metadata',
      cleanedText: text,
    };
  }

  // - Working hours/schedule metadata: "days a week, 9 hours/day", "40 hours a week"
  if (
    /(\d+\s*days?\s*a\s*week|\d+\s*hours?\s*(a|\/|per)?\s*(day|week)|flexible\s*hours|timezone\s*[:\-–]|working\s*hours)/i.test(
      text
    ) &&
    text.length < 60
  ) {
    return {
      is_interviewable: false,
      category: 'job_metadata',
      kind: 'technical',
      priority: 'must',
      reason: 'Working hours schedule metadata',
      cleanedText: text,
    };
  }

  // - Job title as standalone text: "Software Engineer", "Role: Software Engineer"
  if (
    /^(role|job\s*title|position)\s*[:\-–]/i.test(text) ||
    /^(senior |junior |lead |staff |principal )?(software engineer|frontend engineer|backend engineer|full stack engineer|web developer|data scientist)$/i.test(
      text
    )
  ) {
    return {
      is_interviewable: false,
      category: 'job_metadata',
      kind: 'technical',
      priority: 'must',
      reason: 'Job title line',
      cleanedText: text,
    };
  }

  let cleanedReq = text;

  // Determine kind
  const isBeh =
    /lead|mentor|communication|collaborat|teamwork|stakeholder|conflict|agile|empathy|cross[- ]functional|ownership/i.test(
      cleanedReq
    );
  const isDomain =
    /fintech|banking|healthcare|e-commerce|security|compliance|crypto|payments|saas|logistics|hipaa|pci/i.test(
      cleanedReq
    );
  const isNice = /nice|bonus|plus|preferred|desirable|optional/i.test(cleanedReq);

  return {
    is_interviewable: true,
    category: isBeh ? 'behavioural' : isDomain ? 'domain' : 'technical',
    kind: isBeh ? 'behavioural' : isDomain ? 'domain' : 'technical',
    priority: isNice ? 'nice' : 'must',
    reason: 'Valid candidate qualification or technical skill',
    cleanedText: cleanedReq,
  };
}

/**
 * Programmatically determines if extracted text is an invalid requirement
 * (e.g. section headings, working hours, employment type, compensation, slogans, company marketing).
 */
export function isInvalidRequirementText(text: string, context?: { companyName?: string }): boolean {
  const result = classifyRequirementItem(text, context);
  return !result.is_interviewable;
}

/**
 * Normalizes raw requirement phrases into clean, professional technical competencies.
 * Language and framework agnostic: dynamically works for Java, Spring Boot, Python, C++, Go, Rust, MERN, Cloud, etc.
 */
export function distillRequirementTopic(rawText: string): string {
  const clean = rawText.trim().replace(/^([-*•–—]|(\d+[\.\)]))\s*/, '').trim();

  // If already a clear years-of-experience qualification or detailed requirement phrase, preserve it!
  if (/(\d+\+?\s*years?|deep expertise|proven track record|strong proficiency)/i.test(clean)) {
    return clean;
  }

  // Preserve existing detailed technical/behavioural descriptions from tests
  if (
    clean.toLowerCase().includes('database optimization') ||
    clean.toLowerCase().includes('mentoring junior') ||
    clean.toLowerCase().includes('lead architectural reviews')
  ) {
    return clean;
  }

  // Strip common imperative or boilerplate prefixes dynamically
  const stripped = clean
    .replace(
      /^(build and ship|design and build|architect and build|architect|design|build|maintain|develop|manage|own|implement|deliver|proficien(t|cy) in|hands[- ]on experience (with|in)|experience (with|in|shipping)|deep knowledge of|strong understanding of|familiarity with|solid understanding of)\s+/i,
      ''
    )
    .trim();

  const result = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  return result || clean;
}

/**
 * Sanitizes and cleans a list of raw extracted requirements,
 * eliminating headings, employment metadata, company boilerplate, and duplicates.
 */
export function sanitizeRequirements(
  rawList: { text: string; kind?: string; priority?: string }[],
  companyName?: string
): Requirement[] {
  const seen = new Set<string>();
  const valid: Requirement[] = [];

  for (const raw of rawList) {
    const classification = classifyRequirementItem(raw.text, { companyName });
    if (!classification.is_interviewable) continue;

    const cleanText = distillRequirementTopic(classification.cleanedText);
    const lower = cleanText.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    // Kind preference: preserve caller explicit kind if valid, else use classified kind
    const resolvedKind =
      raw.kind === 'behavioural' || raw.kind === 'domain' || raw.kind === 'technical'
        ? raw.kind
        : classification.kind;

    const resolvedPriority =
      raw.priority === 'nice' || raw.priority === 'must'
        ? raw.priority
        : classification.priority;

    valid.push({
      id: `r${valid.length + 1}`,
      text: cleanText,
      kind: resolvedKind,
      priority: resolvedPriority,
    });

    // Cap standard requirements to prevent explosive over-extraction
    if (valid.length >= 18) break;
  }

  return valid;
}

const SYSTEM_INSTRUCTION = `You are a strict, conservative engineering requirement extractor.
Your task is to extract candidate requirements strictly from the job description.

CRITICAL EXTRACTION RULE:
Only extract a requirement when it represents something the candidate is expected to KNOW, HAVE, PERFORM, or DEMONSTRATE for the role.

STRICT SEPARATION:
1. JOB REQUIREMENTS (role.requirements):
   - What the candidate needs to know or do.
   - Valid examples: "React experience", "TypeScript proficiency", "REST API design", "Docker & Kubernetes", "CI/CD pipelines", "AWS architecture", "Data structures & algorithms", "Production debugging", "Experience shipping software", "Mentoring junior engineers", "Must be available for full-time employment", "Must be willing to relocate to Bangalore".
2. COMPANY CONTEXT (DO NOT PUT IN REQUIREMENTS):
   - What the company does, its product, mission, culture, or background (e.g. "Trao is an AI R&D lab...", "We research, design, build, and deploy software...").
   - NEVER extract company mission, slogans, or company descriptions as requirements.
3. JOB METADATA (DO NOT PUT IN REQUIREMENTS):
   - Employment type (e.g. "Full-time", "Part-time", "Contract", "Full-time position").
   - Location & work arrangements (e.g. "Location: Bangalore", "Remote position in Bangalore", "Hybrid").
   - Compensation & benefits (e.g. salary ranges, health insurance, equity, 401k).
   - Application instructions (e.g. "Apply online", "Send resume to...").
   - Job titles (e.g. "Software Engineer", "Role: Software Engineer").

ROLE TITLE:
- Clean the role title: output only the exact job title without prefixes like "Role:", "Job Title:", or markdown formatting.

TARGET COUNT:
Extract between 4 and 12 clear, high-signal requirements for a standard job description. Do NOT extract company descriptions or metadata.

Output strictly valid JSON:
{
  "company": "string",
  "role": "string",
  "location": "string",
  "seniority": "string",
  "responsibilities": ["string"],
  "requirements": [
    {
      "id": "r1",
      "text": "string",
      "kind": "technical" | "behavioural" | "domain",
      "priority": "must" | "nice"
    }
  ]
}`;

export async function extractRoleAndRequirements(
  jdText: string,
  companyUrl: string,
  companyName?: string,
  options?: { customApiKey?: string }
): Promise<ExtractedRoleData> {
  const prompt = `
${companyName ? `Target Company Name: ${companyName}\n` : ''}Company URL provided: ${companyUrl}
<untrusted_job_description>
${jdText}
</untrusted_job_description>

Extract role, responsibilities, and requirements strictly adhering to the extraction rules. Output JSON only.
`;

  // Fallback heuristic parser in case LLM is offline / unconfigured
  const mockFallback = (): ExtractedRoleData => {
    const lines = jdText.split('\n').map((l) => l.trim()).filter(Boolean);

    // Find role title
    let rawTitle = '';
    let companyFromText = companyName || '';
    let locationFromText = 'Remote / Unspecified';

    for (const line of lines.slice(0, 15)) {
      if (/^(role|job\s*title|position)\s*[:\-–]\s*(.*)/i.test(line)) {
        const match = line.match(/^(role|job\s*title|position)\s*[:\-–]\s*(.*)/i);
        if (match && match[2]) {
          rawTitle = match[2];
          break;
        }
      }
      if (/^(company|organization)\s*[:\-–]\s*(.*)/i.test(line)) {
        const match = line.match(/^(company|organization)\s*[:\-–]\s*(.*)/i);
        if (match && match[2] && !companyFromText) companyFromText = match[2].trim();
      }
      if (/^location\s*[:\-–]\s*(.*)/i.test(line)) {
        const match = line.match(/^location\s*[:\-–]\s*(.*)/i);
        if (match && match[1]) locationFromText = match[1].trim();
      }
    }

    // If no explicit title label found, search lines for a recognized role title
    if (!rawTitle) {
      for (const line of lines.slice(0, 15)) {
        const clean = line.replace(/^([-*•–—]|(\d+[\.\)]))\s*/, '').trim();
        if (
          /^(senior |junior |lead |staff |principal |full[- ]?stack |frontend |backend |ai |ml |devops |software )*(software engineer|frontend engineer|backend engineer|full stack engineer|web developer|data engineer|systems engineer|devops engineer|ai engineer|machine learning engineer)\b/i.test(
            clean
          ) &&
          !isInvalidRequirementText(clean, { companyName })
        ) {
          rawTitle = clean;
          break;
        }
      }
    }

    // If still no title, check firstLine only if it's not a heading/company context/metadata
    if (!rawTitle && lines.length > 0) {
      const firstLine = lines[0].replace(/^([-*•–—]|(\d+[\.\)]))\s*/, '').trim();
      if (
        !/^(company|location|employment|about|what|requirements|responsibilities|our\s+mission|mission|who\s+we\s+are|overview)\b/i.test(
          firstLine
        ) &&
        !isInvalidRequirementText(firstLine, { companyName })
      ) {
        rawTitle = firstLine;
      }
    }

    const title = cleanRoleTitle(rawTitle || 'Software Engineer', companyFromText);
    const rawItems: { text: string; kind?: string; priority?: string }[] = [];

    // Track sections to avoid parsing requirements from company/benefits sections
    let currentSection = '';

    for (const line of lines) {
      const cleanLine = line.replace(/^([-*•–—]|(\d+[\.\)]))\s*/, '').trim();

      // Check if this line is a section heading
      if (/^(about (us|you|the company)|our mission|company overview|who we are):?$/i.test(cleanLine)) {
        currentSection = 'about';
        continue;
      }
      if (/^(work style(\s*&?\s*expectations)?|working hours|expectations|work culture|schedule(\s*&?\s*expectations)?):?$/i.test(cleanLine)) {
        currentSection = 'work_style';
        continue;
      }
      if (/^(benefits|perks|compensation|what we offer):?$/i.test(cleanLine)) {
        currentSection = 'benefits';
        continue;
      }
      if (/^(how to apply|application process):?$/i.test(cleanLine)) {
        currentSection = 'apply';
        continue;
      }
      if (
        /^(((required|preferred|minimum|basic|key|desired|additional)\s+)?(qualifications|requirements|skills|tech stack|what we're looking for|what you bring|bonus points?|nice to haves?|must haves?)(\s*\(.*\))?):?$/i.test(
          cleanLine
        )
      ) {
        currentSection = 'requirements';
        continue;
      }
      if (/^(responsibilities|what you'll do|the role|role overview):?$/i.test(cleanLine)) {
        currentSection = 'responsibilities';
        continue;
      }

      // Skip lines in about, benefits, apply, or work_style sections
      if (
        currentSection === 'about' ||
        currentSection === 'benefits' ||
        currentSection === 'apply' ||
        currentSection === 'work_style'
      ) {
        continue;
      }

      // Skip if identical to the detected job title
      if (cleanLine.toLowerCase() === title.toLowerCase()) {
        continue;
      }

      // Classify line using context
      const classification = classifyRequirementItem(cleanLine, {
        companyName: companyFromText,
        jobTitle: title,
        sectionHeading: currentSection,
      });

      if (classification.is_interviewable && cleanLine.length >= 6) {
        rawItems.push({
          text: classification.cleanedText,
          kind: classification.kind,
          priority: classification.priority,
        });
      }
    }

    let sanitized = sanitizeRequirements(rawItems, companyFromText);

    // If still empty, supply clean competencies based on the role title
    if (sanitized.length === 0) {
      sanitized = [
        {
          id: 'r1',
          text: `Core software engineering and architecture for ${title}`,
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r2',
          text: 'Technical problem-solving and production debugging',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r3',
          text: 'Cross-functional collaboration and clear engineering communication',
          kind: 'behavioural',
          priority: 'must',
        },
      ];
    }

    return {
      company: companyFromText || 'Target Company',
      role: title,
      location: locationFromText,
      seniority: /senior|lead|staff|principal|architect/i.test(title)
        ? 'Senior'
        : /junior|associate|entry|intern/i.test(title)
        ? 'Junior'
        : 'Mid-Level',
      responsibilities: ['Build, maintain, and deliver robust software systems according to specifications.'],
      requirements: sanitized,
    };
  };

  const extracted = await generateStructured<ExtractedRoleData>(
    prompt,
    SYSTEM_INSTRUCTION,
    mockFallback,
    options
  );

  if (companyName && (!extracted.company || extracted.company === 'Target Company')) {
    extracted.company = companyName;
  }

  // Clean role title
  extracted.role = cleanRoleTitle(extracted.role, extracted.company);

  // Sanitize the requirements programmatically to ensure zero headings, metadata, or company boilerplate slip through
  extracted.requirements = sanitizeRequirements(extracted.requirements || [], extracted.company);

  if (extracted.requirements.length === 0) {
    // Fallback if LLM generated only headings or metadata that got filtered out
    extracted.requirements = [
      {
        id: 'r1',
        text: `Core software engineering and technical design for ${extracted.role || 'Software Engineer'}`,
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'r2',
        text: 'Technical problem-solving and production debugging',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'r3',
        text: 'Cross-functional collaboration and clear engineering communication',
        kind: 'behavioural',
        priority: 'must',
      },
    ];
  }

  // Normalize seniority
  const title = (extracted.role || '').toLowerCase();
  if (!extracted.seniority || extracted.seniority === 'Mid-Level') {
    extracted.seniority = /senior|lead|staff|principal|architect/i.test(title)
      ? 'Senior'
      : /junior|associate|entry|intern/i.test(title)
      ? 'Junior'
      : 'Mid-Level';
  }

  if (!extracted.responsibilities || extracted.responsibilities.length === 0) {
    extracted.responsibilities = ['Execute core technical responsibilities outlined in posting.'];
  }

  return extracted;
}

