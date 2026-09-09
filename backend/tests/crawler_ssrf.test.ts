import { describe, it, expect } from 'vitest';
import { validateExternalUrl } from '../pipeline/ssrfGuard.js';
import { scoreLink } from '../pipeline/crawler.js';

describe('SSRF Guard & Crawler Link Ranking', () => {
  it('permits localhost when in evaluation mode', async () => {
    const res = await validateExternalUrl('http://localhost:8099/acme/', true);
    expect(res.isValid).toBe(true);
    expect(res.normalizedUrl).toBe('http://localhost:8099/acme/');
  });

  it('rejects AWS metadata address', async () => {
    const res = await validateExternalUrl('http://169.254.169.254/latest/meta-data/', false);
    expect(res.isValid).toBe(false);
    expect(res.error).toMatch(/restricted/i);
  });

  it('scores hiring and interview links much higher than regular links', () => {
    const hiringScore = scoreLink('/company/how-we-hire', 'How We Hire');
    const careersScore = scoreLink('/careers', 'Join Our Team');
    const genericScore = scoreLink('/products/overview', 'Products');
    const socialScore = scoreLink('https://twitter.com/company', 'Twitter');

    expect(hiringScore).toBeGreaterThan(careersScore);
    expect(careersScore).toBeGreaterThan(genericScore);
    expect(socialScore).toBeLessThan(0);
  });
});
