import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { runPipeline } from '../pipeline/runner.js';
import { AppendixAKit } from '../pipeline/schema.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Explicitly mark evaluation mode so localhost / local test addresses are allowed
process.env.EVALUATION_MODE = 'true';

interface CaseInput {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

interface KitSuccessResult {
  id: string;
  status: 'ok';
  kit: AppendixAKit;
  error: null;
}

interface KitFailureResult {
  id: string;
  status: 'failed';
  kit: null;
  error: {
    code: string;
    message: string;
  };
}

type KitResult = KitSuccessResult | KitFailureResult;

interface EvaluationOutput {
  version: '1.0';
  generated_at: string;
  kits: KitResult[];
}

function parseArgs(): { inputFile: string; outputFile: string } {
  const args = process.argv.slice(2);
  let inputFile = '';
  let outputFile = '';

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--input' || args[i] === '-i') && args[i + 1]) {
      inputFile = args[i + 1];
      i++;
    } else if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    } else if (args[i].startsWith('--input=')) {
      inputFile = args[i].split('=')[1];
    } else if (args[i].startsWith('--output=')) {
      outputFile = args[i].split('=')[1];
    }
  }

  // Positional fallback if flags were stripped by package runner
  if (!inputFile && args[0] && !args[0].startsWith('-')) {
    inputFile = args[0];
  }
  if (!outputFile && args[1] && !args[1].startsWith('-')) {
    outputFile = args[1];
  }

  if (!inputFile || !outputFile) {
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    process.exit(1);
  }

  return { inputFile, outputFile };
}

async function main() {
  const { inputFile, outputFile } = parseArgs();

  const resolvedInputPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.resolve(process.cwd(), inputFile);
  const resolvedOutputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.resolve(process.cwd(), outputFile);

  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`Input file not found: ${resolvedInputPath}`);
    process.exit(1);
  }

  const rawInput = fs.readFileSync(resolvedInputPath, 'utf-8');
  let cases: CaseInput[] = [];
  try {
    cases = JSON.parse(rawInput);
    if (!Array.isArray(cases)) {
      throw new Error('Input must be a JSON array of cases.');
    }
  } catch (err: any) {
    console.error(`Failed to parse input JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Batch Evaluator] Processing ${cases.length} case(s)...`);

  const results: KitResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(`\n[${i + 1}/${cases.length}] Evaluating case "${c.id}" (${c.company_url || 'no url'})...`);

    try {
      if (!c.jd || typeof c.jd !== 'string') {
        throw new Error('Missing job description (jd) in input case.');
      }

      const kit = await runPipeline(
        {
          id: c.id,
          jd: c.jd,
          company_url: c.company_url || '',
          days: c.days || 5,
        },
        (stage, percent) => {
          process.stdout.write(`\r  -> Stage: ${stage} (${percent}%)`);
        }
      );
      process.stdout.write('\n');

      results.push({
        id: c.id,
        status: 'ok',
        kit,
        error: null,
      });
      console.log(`  [OK] Successfully generated kit for ${c.id}`);
    } catch (caseErr: any) {
      process.stdout.write('\n');
      console.error(`  [FAILED] Case ${c.id} failed: ${caseErr.message}`);

      results.push({
        id: c.id,
        status: 'failed',
        kit: null,
        error: {
          code: caseErr.code || 'PIPELINE_ERROR',
          message: caseErr.message || 'An error occurred while generating the kit.',
        },
      });
    }

    // Rate-limit pause between cases to comfortably respect token-per-minute limits
    if (i < cases.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const outputPayload: EvaluationOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results,
  };

  // Ensure output directory exists
  const outDir = path.dirname(resolvedOutputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(resolvedOutputPath, JSON.stringify(outputPayload, null, 2), 'utf-8');
  console.log(`\n[Batch Evaluator] Done! Output written to: ${resolvedOutputPath}`);
}

main().catch((err) => {
  console.error('[Batch Evaluator] Fatal runner error:', err);
  process.exit(1);
});
