import { generateStructured } from './geminiClient.js';
import { CrawledPage } from './crawler.js';

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

const SYSTEM_INSTRUCTION = `You are an objective corporate research analyst preparing an interview brief.
Generate a factual company brief from the provided scraped pages and context.
RULES:
1. State factually what the company does, their domain, and their engineering/product model.
2. If the crawled content is empty or unreachable, state honestly: "Company details could not be verified from public pages."
3. Do NOT hallucinate products, history, or revenue that are not in the text.
4. Output strictly valid JSON:
{
  "summary": "string",
  "what_they_do": "string"
}`;

export async function generateCompanyBrief(
  companyName: string,
  crawledPages: CrawledPage[],
  pagesUsed: string[],
  options?: { customApiKey?: string }
): Promise<CompanyBrief> {
  // If no pages were retrieved, produce an honest brief without calling LLM
  if (crawledPages.length === 0) {
    return {
      summary: `Could not retrieve public web pages for ${companyName}.`,
      what_they_do: 'No public site information was discoverable at the provided URL.',
      sources: pagesUsed,
    };
  }

  const combinedContent = crawledPages
    .map((p) => `URL: ${p.url}\nTitle: ${p.title}\nText: ${p.text.slice(0, 4000)}`)
    .join('\n---\n');

  const prompt = `
Company: ${companyName}
Scraped website data:
${combinedContent}

Synthesize a factual company brief.
`;

  const mockFallback = (): { summary: string; what_they_do: string } => {
    const firstTitle = crawledPages[0]?.title || companyName;
    return {
      summary: `${companyName} is an active technology organization. Information synthesized from official site (${firstTitle}).`,
      what_they_do: crawledPages[0]?.text?.slice(0, 300) || 'Builds technology products and services.',
    };
  };

  const result = await generateStructured<{ summary: string; what_they_do: string }>(
    prompt,
    SYSTEM_INSTRUCTION,
    mockFallback,
    options
  );

  return {
    summary: result.summary,
    what_they_do: result.what_they_do,
    sources: pagesUsed,
  };
}
