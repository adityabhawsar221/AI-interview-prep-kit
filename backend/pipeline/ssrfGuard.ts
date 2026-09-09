import { URL } from 'url';
import dns from 'dns/promises';

const PRIVATE_IP_RANGES = [
  /^127\./,                         // Loopback
  /^10\./,                          // Private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private class B
  /^192\.168\./,                    // Private class C
  /^169\.254\./,                    // Link-local / AWS metadata
  /^0\./,                           // Current network
  /^::1$/,                          // IPv6 loopback
  /^fc00:/,                         // IPv6 private
  /^fe80:/,                         // IPv6 link-local
];

export interface SSRFValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Allows localhost/loopback when isEvaluationOrTest is true (for local evaluation servers).
 */
export async function validateExternalUrl(
  inputUrl: string,
  isEvaluationOrTest = false
): Promise<SSRFValidationResult> {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    // Add protocol if missing
    let target = inputUrl.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    parsed = new URL(target);
  } catch (err: any) {
    return { isValid: false, error: `Invalid URL format: ${err.message}` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Protocol must be http or https' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Unconditionally reject cloud metadata / link-local addresses
  if (hostname.startsWith('169.254.') || parsed.host.includes('169.254')) {
    return { isValid: false, error: 'Access to cloud metadata / link-local IP (169.254.x.x) is restricted' };
  }

  // Local evaluation mode allows localhost / loopback for local test servers
  const isLocalEvaluation = isEvaluationOrTest || process.env.EVALUATION_MODE === 'true';

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    if (isLocalEvaluation) {
      return { isValid: true, normalizedUrl: parsed.toString() };
    }
    return { isValid: false, error: 'Access to localhost/loopback addresses is restricted in production' };
  }

  // Resolve hostname to check resolved IP
  try {
    const lookup = await dns.lookup(hostname);
    const ip = lookup.address;

    if (ip.startsWith('169.254.')) {
      return { isValid: false, error: 'Access to cloud metadata IP (169.254.x.x) is restricted' };
    }

    for (const range of PRIVATE_IP_RANGES) {
      if (range.test(ip)) {
        if (isLocalEvaluation && (ip.startsWith('127.') || ip === '::1')) {
          return { isValid: true, normalizedUrl: parsed.toString() };
        }
        return { isValid: false, error: `Access to private network IP (${ip}) is restricted` };
      }
    }
  } catch (err: any) {
    if (!isLocalEvaluation) {
      return { isValid: false, error: `DNS resolution failed for hostname ${hostname}: ${err.message}` };
    }
  }

  return { isValid: true, normalizedUrl: parsed.toString() };
}
