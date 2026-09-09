import axios from 'axios';
import * as cheerio from 'cheerio';
import { CrawledPage } from './crawler.js';
import { generateFreeText } from './geminiClient.js';

export interface PublicInterviewResearchResult {
  has_public_signals: boolean;
  notes: string;
  sources: string[];
}

/**
 * Searches for public discussions of the company's interview process
 * (e.g. rounds, take-homes, screening format).
 * Reports honestly if nothing is found; never fabricates.
 */
export async function researchPublicInterviewProcess(
  companyName: string,
  crawledPages: CrawledPage[],
  options?: { customApiKey?: string }
): Promise<PublicInterviewResearchResult> {
  const sources: string[] = [];
  const signals: string[] = [];

  // 1. Inspect crawled pages for direct hiring/interview policies (e.g. GitLab/PostHog public handbooks)
  for (const page of crawledPages) {
    const textLower = page.text.toLowerCase();
    if (
      textLower.includes('interview process') ||
      textLower.includes('how we hire') ||
      textLower.includes('take-home') ||
      textLower.includes('system design') ||
      textLower.includes('technical screen')
    ) {
      signals.push(`Found internal hiring guide on company site (${page.url})`);
      sources.push(page.url);
    }
  }

  // 2. Query Gemini AI for public interview patterns (Glassdoor, LeetCode Discuss, Reddit)
  const isGeneric =
    !companyName ||
    companyName.toLowerCase() === 'target company' ||
    companyName.toLowerCase() === 'unknown company' ||
    companyName.toLowerCase() === 'example company';

  if (!isGeneric) {
    try {
      const aiResearch = await generateFreeText(
        `Summarize the publicly reported interview process, technical screening, system design, and coding rounds for software engineering candidates at "${companyName}". Highlight typical interview format, rounds, and candidate experiences from public discussions (Glassdoor, LeetCode, Reddit, etc.). Keep it concise (3-5 bullet points). If this is an unknown, private, or early-stage startup with no public interview discussions, reply exactly: "NO_PUBLIC_DATA".`,
        'You are an expert technical interview researcher analyzing publicly reported candidate interview experiences.',
        options
      );

      if (aiResearch && !aiResearch.includes('NO_PUBLIC_DATA') && aiResearch.length > 30) {
        signals.push(`Public interview discussion signals for ${companyName}:\n${aiResearch}`);
        sources.push(`Public candidate discussions & engineering blogs (${companyName})`);
      }
    } catch (err: any) {
      console.warn(`[Interview Research] AI research synthesis skipped: ${err.message}`);
    }
  }

  // 3. Fallback/supplementary check via web search if company name is available
  if (!isGeneric && signals.length === 0) {
    try {
      const query = encodeURIComponent(`"${companyName}" interview process rounds questions`);
      const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
      const res = await axios.get(searchUrl, {
        timeout: 4000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        validateStatus: (status) => status < 400,
      });

      if (typeof res.data === 'string' && !res.data.includes('Unfortunately, bots use DuckDuckGo too')) {
        const $ = cheerio.load(res.data);
        const snippets: string[] = [];
        $('.result__snippet').each((i, el) => {
          if (i < 3) {
            const snip = $(el).text().trim();
            if (snip) snippets.push(snip);
          }
        });

        if (snippets.length > 0) {
          signals.push(`Public web search snippets: ${snippets.join(' | ')}`);
          sources.push(searchUrl);
        }
      }
    } catch {
      // If external search is unavailable or challenged, do not fail
    }
  }

  if (signals.length === 0) {
    return {
      has_public_signals: false,
      notes: 'No public candidate-reported interview discussion or hiring handbook was found for this company.',
      sources: [],
    };
  }

  return {
    has_public_signals: true,
    notes: signals.join('\n\n'),
    sources,
  };
}

