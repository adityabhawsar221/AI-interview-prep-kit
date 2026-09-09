import { Requirement, Question } from './schema.js';

export interface CoverageReport {
  has_must_gaps: boolean;
  uncovered_must_ids: string[];
  uncovered_all_ids: string[];
  covered_ids: string[];
  coverage_percentage: number;
}

/**
 * Deterministically checks which requirements are covered by questions.
 * This is pure arithmetic/set logic and is strictly NOT decided by the model.
 */
export function checkCoverage(
  requirements: Requirement[],
  questions: Question[]
): CoverageReport {
  // Collect all requirement IDs referenced across all questions
  const coveredSet = new Set<string>();
  for (const q of questions) {
    for (const rId of q.requirement_ids) {
      coveredSet.add(rId);
    }
  }

  const uncoveredMustIds: string[] = [];
  const uncoveredAllIds: string[] = [];
  const coveredIds: string[] = [];

  for (const req of requirements) {
    if (coveredSet.has(req.id)) {
      coveredIds.push(req.id);
    } else {
      uncoveredAllIds.push(req.id);
      if (req.priority === 'must') {
        uncoveredMustIds.push(req.id);
      }
    }
  }

  const totalReqs = requirements.length;
  const coveragePercentage =
    totalReqs === 0 ? 100 : Math.round((coveredIds.length / totalReqs) * 100);

  return {
    has_must_gaps: uncoveredMustIds.length > 0,
    uncovered_must_ids: uncoveredMustIds,
    uncovered_all_ids: uncoveredAllIds,
    covered_ids: coveredIds,
    coverage_percentage: coveragePercentage,
  };
}
