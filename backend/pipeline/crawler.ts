import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { URL } from 'url';
import { validateExternalUrl } from './ssrfGuard.js';

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  isHiringPage: boolean;
}

export interface CrawlResult {
  pages: CrawledPage[];
  pages_used: string[];
  hiring_info_found: boolean;
  notes: string[];
}

const RELEVANCE_KEYWORDS = [
  { term: 'how-we-hire', weight: 10 },
  { term: 'interview', weight: 9 },
  { term: 'hiring', weight: 8 },
  { term: 'careers', weight: 7 },
  { term: 'jobs', weight: 7 },
  { term: 'handbook', weight: 6 },
  { term: 'engineering', weight: 5 },
  { term: 'culture', weight: 5 },
  { term: 'about', weight: 4 },
  { term: 'team', weight: 4 },
];

/**
 * Normalizes text extracted from HTML.
 */
function cleanHtmlText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  // Remove non-content elements
  $('script, style, noscript, svg, iframe, nav, footer').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim() || '';
  const bodyText = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000); // Limit text length to avoid token bloat

  return { title, text: bodyText };
}

/**
 * Evaluates how likely a URL / link text is a hiring or about page.
 */
export function scoreLink(href: string, anchorText: string): number {
  const lowerHref = href.toLowerCase();
  const lowerText = anchorText.toLowerCase();
  let score = 0;

  for (const { term, weight } of RELEVANCE_KEYWORDS) {
    const termSpace = term.replace(/-/g, ' ');
    if (lowerHref.includes(term) || lowerHref.includes(termSpace)) score += weight;
    if (lowerText.includes(term) || lowerText.includes(termSpace)) score += weight;
  }

  // Penalize social media or external tracking links
  if (
    lowerHref.includes('linkedin.com') ||
    lowerHref.includes('twitter.com') ||
    lowerHref.includes('facebook.com') ||
    lowerHref.includes('instagram.com') ||
    lowerHref.includes('#') ||
    lowerHref.startsWith('mailto:')
  ) {
    score = -100;
  }

  return score;
}

/**
 * Crawls target company website, respects robots.txt, ranks links,
 * and discovers hiring/culture information.
 */
export async function crawlCompanySite(
  companyUrl: string,
  isEvaluationOrTest = false
): Promise<CrawlResult> {
  const notes: string[] = [];
  const pages: CrawledPage[] = [];
  const pages_used: string[] = [];

  // 1. SSRF & URL validation
  const ssrfCheck = await validateExternalUrl(companyUrl, isEvaluationOrTest);
  if (!ssrfCheck.isValid || !ssrfCheck.normalizedUrl) {
    notes.push(`Invalid company URL or SSRF block: ${ssrfCheck.error}`);
    return { pages, pages_used, hiring_info_found: false, notes };
  }

  const targetUrl = ssrfCheck.normalizedUrl;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err: any) {
    notes.push(`Failed parsing URL: ${err.message}`);
    return { pages, pages_used, hiring_info_found: false, notes };
  }

  // 2. Fetch and check robots.txt
  let isAllowed = true;
  try {
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
    const robotsRes = await axios.get(robotsUrl, {
      timeout: 4000,
      maxContentLength: 100000,
      headers: { 'User-Agent': 'TraoInterviewPrepBot/1.0' },
      validateStatus: () => true,
    });

    if (robotsRes.status === 200 && typeof robotsRes.data === 'string') {
      const robots = robotsParser(robotsUrl, robotsRes.data);
      isAllowed = robots.isAllowed(targetUrl, 'TraoInterviewPrepBot') ?? true;
    }
  } catch {
    // If robots.txt fails or 404s, standard behavior is to allow crawling
    isAllowed = true;
  }

  if (!isAllowed) {
    notes.push('Target URL is disallowed by company robots.txt. Crawling skipped.');
    return { pages, pages_used, hiring_info_found: false, notes };
  }

  // 3. Fetch Root Page
  let rootHtml = '';
  try {
    const res = await axios.get(targetUrl, {
      timeout: 7000,
      maxContentLength: 500000, // 500KB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      validateStatus: (status) => status < 400,
    });
    rootHtml = typeof res.data === 'string' ? res.data : '';
    pages_used.push(targetUrl);
    const cleaned = cleanHtmlText(rootHtml);
    pages.push({
      url: targetUrl,
      title: cleaned.title || 'Homepage',
      text: cleaned.text,
      isHiringPage: false,
    });
  } catch (err: any) {
    notes.push(`Failed retrieving root page ${targetUrl}: ${err.message || 'Connection error'}`);
    return { pages, pages_used, hiring_info_found: false, notes };
  }

  // 4. Discover and Rank Internal Links
  const $ = cheerio.load(rootHtml);
  const candidateLinks: { url: string; score: number }[] = [];
  const seenUrls = new Set<string>([targetUrl]);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const text = $(el).text().trim();
    if (!href) return;

    try {
      // Resolve relative URLs using standard URL resolution
      const resolved = new URL(href, targetUrl);

      // Same host or same root
      if (resolved.host === parsedUrl.host) {
        const fullUrl = resolved.toString();
        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          const score = scoreLink(resolved.pathname + resolved.search, text);
          if (score > 0) {
            candidateLinks.push({ url: fullUrl, score });
          }
        }
      }
    } catch {
      // Ignore unparseable hrefs
    }
  });

  // Sort candidate links by score descending
  candidateLinks.sort((a, b) => b.score - a.score);

  // Fetch top 2 candidate pages
  let hiringFound = false;
  const topLinks = candidateLinks.slice(0, 2);

  for (const candidate of topLinks) {
    try {
      const pageRes = await axios.get(candidate.url, {
        timeout: 6000,
        maxContentLength: 500000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        validateStatus: (status) => status < 400,
      });

      if (typeof pageRes.data === 'string') {
        const cleaned = cleanHtmlText(pageRes.data);
        pages_used.push(candidate.url);
        const isHiring = candidate.score >= 6;
        if (isHiring) hiringFound = true;

        pages.push({
          url: candidate.url,
          title: cleaned.title,
          text: cleaned.text,
          isHiringPage: isHiring,
        });
      }
    } catch (pageErr: any) {
      notes.push(`Skipped candidate link ${candidate.url}: ${pageErr.message}`);
    }
  }

  if (!hiringFound) {
    notes.push('No dedicated hiring or career page discovered on company website.');
  }

  return {
    pages,
    pages_used,
    hiring_info_found: hiringFound,
    notes,
  };
}
