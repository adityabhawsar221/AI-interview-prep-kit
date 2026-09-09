import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

// In-memory rate-limiter queue to guarantee free-tier compliance (<= 15 RPM / 40 TPM)
let lastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL_MS = 2000; // 2 seconds between LLM calls to prevent 429 Resource Exhausted on free tier

async function throttle(): Promise<void> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTimestamp;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTimestamp = Date.now();
}

/**
 * Executes an async operation with exponential backoff and jitter.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 2500;
  let attempt = 0;

  while (true) {
    try {
      await throttle();
      return await operation();
    } catch (err: any) {
      attempt++;
      const errorMessage = err?.message || String(err);
      const isRateLimit =
        errorMessage.includes('429') ||
        errorMessage.toLowerCase().includes('resource exhausted');

      // If daily quota or long wait (>5s) is required, throw immediately to try next candidate model
      if (errorMessage.toLowerCase().includes('perday') || errorMessage.includes('retryDelay":"4') || errorMessage.includes('retryDelay":"5') || errorMessage.includes('retryDelay":"6')) {
        throw err;
      }

      if (attempt > maxRetries || !isRateLimit) {
        throw err;
      }

      // Exponential backoff with random jitter
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(
        `[LLM RateLimit/Retry] Attempt ${attempt} hit rate limit. Backing off for ${Math.round(
          delay
        )}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Calls Groq Cloud API as a secondary free-tier fallback if configured.
 */
async function callGroqFallback<T>(
  prompt: string,
  systemInstruction?: string,
  groqKey?: string
): Promise<T> {
  if (!groqKey) {
    throw new Error('No Groq API key available for fallback.');
  }

  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 25000,
    }
  );

  const text = res.data?.choices?.[0]?.message?.content || '{}';
  const cleaned = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Calls OpenAI API as an additional fallback if OPENAI_API_KEY is configured.
 */
async function callOpenAIFallback<T>(
  prompt: string,
  systemInstruction?: string,
  openAiKey?: string
): Promise<T> {
  if (!openAiKey) {
    throw new Error('No OpenAI API key available for fallback.');
  }

  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 25000,
    }
  );

  const text = res.data?.choices?.[0]?.message?.content || '{}';
  const cleaned = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned) as T;
}

async function callOpenAIFreeText(
  prompt: string,
  systemInstruction?: string,
  openAiKey?: string
): Promise<string | null> {
  if (!openAiKey) return null;
  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 25000,
    }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * Global or context-injected API key cache
 */
let runtimeApiKey: string | null = null;

export function setRuntimeApiKey(key: string): void {
  if (key && key.trim().length > 10) {
    runtimeApiKey = key.trim();
  }
}

export function getEffectiveApiKey(customKey?: string): string | null {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
    try {
      dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env'), override: true });
      dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
      dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });
    } catch {}
  }

  const key =
    customKey?.trim() ||
    runtimeApiKey ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    null;

  if (!key || key === 'your_gemini_api_key_here' || key.length < 10) {
    return null;
  }
  return key;
}

/**
 * Structured LLM JSON Generation client.
 * Connects to Google Gemini API with rate-limiting throttling, exponential backoff,
 * multi-model pool failovers, and automatic fallback to OpenAI / Groq if configured.
 */
export async function generateStructured<T>(
  prompt: string,
  systemInstruction?: string,
  mockFallback?: () => T,
  options?: { customApiKey?: string }
): Promise<T> {
  const apiKey = getEffectiveApiKey(options?.customApiKey);
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  // If no AI keys are configured
  if (!apiKey && !openAiKey && !groqKey) {
    if (mockFallback && isTestEnv) {
      return mockFallback();
    }
    throw new Error('No AI API key found. Please ensure GEMINI_API_KEY or OPENAI_API_KEY is configured in .env');
  }

  // If Gemini API Key is available, invoke Google Generative AI
  if (apiKey) {
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-flash-latest',
    ];

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        return await withRetry(async () => {
          console.info(`[Gemini API] Requesting ${modelName} with temperature 0.7...`);
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction
              ? { role: 'system', parts: [{ text: systemInstruction }] }
              : undefined,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          });

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          try {
            return JSON.parse(text) as T;
          } catch (parseErr: any) {
            const cleaned = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
            return JSON.parse(cleaned) as T;
          }
        });
      } catch (geminiError: any) {
        lastError = geminiError;
        console.warn(`[LLM Client] Model ${modelName} failed (${geminiError.message}), trying next model...`);
      }
    }

    console.warn(`[LLM Client] All Gemini models failed: ${lastError?.message}`);

    // Try OpenAI fallback if configured
    if (openAiKey) {
      try {
        console.info('[LLM Client] Switching to OpenAI fallback (gpt-4o-mini)...');
        return await callOpenAIFallback<T>(prompt, systemInstruction, openAiKey);
      } catch (openAiErr: any) {
        console.warn(`[LLM Client] OpenAI fallback failed: ${openAiErr.message}`);
      }
    }

    // Try Groq if available
    if (groqKey) {
      try {
        console.info('[LLM Client] Switching to secondary Groq provider...');
        return await callGroqFallback<T>(prompt, systemInstruction, groqKey);
      } catch (groqErr: any) {
        console.warn(`[LLM Client] Groq fallback also failed: ${groqErr.message}`);
      }
    }

    // In unit test environment, fallback is acceptable, but in live runtime we never want fake static questions!
    if (mockFallback && isTestEnv) {
      console.warn('[LLM Client] Falling back to offline generator in test environment.');
      return mockFallback();
    }
    throw lastError || new Error('All Gemini API models failed: ' + (lastError?.message || 'unknown error'));
  }

  // If only OpenAI key is present
  if (openAiKey) {
    try {
      console.info('[LLM Client] Using configured OpenAI key (gpt-4o-mini)...');
      return await callOpenAIFallback<T>(prompt, systemInstruction, openAiKey);
    } catch (openAiErr: any) {
      if (groqKey) {
        return await callGroqFallback<T>(prompt, systemInstruction, groqKey);
      }
      if (mockFallback && isTestEnv) return mockFallback();
      throw openAiErr;
    }
  }

  // If only Groq key is present
  if (groqKey) {
    try {
      return await callGroqFallback<T>(prompt, systemInstruction, groqKey);
    } catch (groqErr: any) {
      if (mockFallback && isTestEnv) return mockFallback();
      throw groqErr;
    }
  }

  if (mockFallback && isTestEnv) return mockFallback();
  throw new Error('LLM Generation failed.');
}

/**
 * Free-form text generator for open-ended synthesis (e.g. interview research, round details).
 */
export async function generateFreeText(
  prompt: string,
  systemInstruction?: string,
  options?: { customApiKey?: string }
): Promise<string | null> {
  const apiKey = getEffectiveApiKey(options?.customApiKey);
  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (apiKey) {
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-flash-latest',
    ];

    for (const modelName of candidateModels) {
      try {
        return await withRetry(async () => {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction
              ? { role: 'system', parts: [{ text: systemInstruction }] }
              : undefined,
          });

          const result = await model.generateContent(prompt);
          const response = await result.response;
          return response.text()?.trim() || null;
        });
      } catch (err: any) {
        console.warn(`[LLM FreeText] Model ${modelName} failed (${err.message}), trying next...`);
      }
    }
  }

  // If Gemini models failed or no Gemini key, try OpenAI
  if (openAiKey) {
    try {
      console.info('[LLM FreeText] Using OpenAI fallback...');
      return await callOpenAIFreeText(prompt, systemInstruction, openAiKey);
    } catch (err: any) {
      console.warn(`[LLM FreeText] OpenAI failed: ${err.message}`);
    }
  }

  return null;
}

