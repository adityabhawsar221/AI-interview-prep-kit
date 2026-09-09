import { Question, Requirement, Schedule, ScheduleDay } from './schema.js';

/**
 * Deterministic schedule allocator.
 * Distributes questions across exactly daysAvailable days.
 * Arithmetic only — no LLM calls.
 */
export function buildSchedule(
  questions: Question[],
  requirements: Requirement[],
  daysAvailable: number
): Schedule {
  // Clamp days between 1 and 60
  const totalDays = Math.max(1, Math.min(60, Math.floor(daysAvailable) || 5));

  if (questions.length === 0) {
    // Fallback if no questions were provided
    const emptyDays: ScheduleDay[] = [];
    for (let d = 1; d <= totalDays; d++) {
      emptyDays.push({
        day: d,
        focus: d === totalDays ? 'Final Review & Preparation' : `Day ${d} Study & Research`,
        question_ids: [],
        minutes: 60,
      });
    }
    return { days_available: totalDays, days: emptyDays };
  }

  const mustReqIdSet = new Set(
    requirements.filter((r) => r.priority === 'must').map((r) => r.id)
  );

  // Score questions so harder and higher-priority questions land earlier
  const scoredQuestions = [...questions].sort((a, b) => {
    // Check if covers must requirement
    const aMust = a.requirement_ids.some((id) => mustReqIdSet.has(id)) ? 1000 : 0;
    const bMust = b.requirement_ids.some((id) => mustReqIdSet.has(id)) ? 1000 : 0;

    // Difficulty score: 3 is highest priority to learn early
    const diffOrder = { 3: 300, 2: 200, 1: 100 };
    const aDiff = diffOrder[a.difficulty] || 100;
    const bDiff = diffOrder[b.difficulty] || 100;

    // Category preference: technical and system-design earlier, behavioural/fit later
    const catOrder: Record<string, number> = {
      'system-design': 40,
      technical: 30,
      behavioural: 20,
      'company-fit': 10,
    };
    const aCat = catOrder[a.category] || 10;
    const bCat = catOrder[b.category] || 10;

    return (bMust + bDiff + bCat) - (aMust + aDiff + aCat);
  });

  // Prepare array for each day
  const dayBuckets: string[][] = Array.from({ length: totalDays }, () => []);

  // Distribute questions across the days
  if (totalDays === 1) {
    // All questions on day 1
    dayBuckets[0] = scoredQuestions.map((q) => q.id);
  } else if (totalDays <= scoredQuestions.length) {
    // Distribute chunked/round-robin
    scoredQuestions.forEach((q, idx) => {
      // Chunk distribution keeps similar priority questions on earlier days
      const targetDay = Math.min(totalDays - 1, Math.floor((idx / scoredQuestions.length) * totalDays));
      dayBuckets[targetDay].push(q.id);
    });
  } else {
    // More days than questions (e.g. 30 days requested for 12 questions)
    // Put primary questions in early days, then repeat/review questions on later days
    scoredQuestions.forEach((q, idx) => {
      dayBuckets[idx].push(q.id);
    });

    // Fill remaining days with review sets of high-priority questions
    for (let d = scoredQuestions.length; d < totalDays; d++) {
      const reviewQuestion = scoredQuestions[(d - scoredQuestions.length) % scoredQuestions.length];
      dayBuckets[d].push(reviewQuestion.id);
    }
  }

  // Ensure every day has at least one question
  for (let d = 0; d < totalDays; d++) {
    if (dayBuckets[d].length === 0) {
      // Borrow or review the first question
      dayBuckets[d].push(scoredQuestions[0].id);
    }
  }

  // Guarantee all must-have requirements appear in the schedule
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const scheduledMustReqs = new Set<string>();

  for (const bucket of dayBuckets) {
    for (const qId of bucket) {
      const q = questionMap.get(qId);
      if (q) {
        q.requirement_ids.forEach((rId) => {
          if (mustReqIdSet.has(rId)) scheduledMustReqs.add(rId);
        });
      }
    }
  }

  // If any must-have requirement's question is somehow missing from schedule, insert it on Day 1
  for (const mustReqId of mustReqIdSet) {
    if (!scheduledMustReqs.has(mustReqId)) {
      const matchingQ = questions.find((q) => q.requirement_ids.includes(mustReqId));
      if (matchingQ && !dayBuckets[0].includes(matchingQ.id)) {
        dayBuckets[0].unshift(matchingQ.id);
      }
    }
  }

  // Generate day-by-day schedule objects with focus and integer minutes
  const days: ScheduleDay[] = dayBuckets.map((qIds, idx) => {
    const dayNum = idx + 1;
    const dayQuestions = qIds.map((id) => questionMap.get(id)).filter(Boolean) as Question[];

    // Determine focus theme
    let focus = '';
    if (dayNum === 1 && totalDays > 1) {
      focus = 'Core Must-Have Requirements & Technical Foundations';
    } else if (dayNum === totalDays) {
      focus = 'Comprehensive Review & Behavioral Readiness';
    } else {
      const catCounts: Record<string, number> = {};
      dayQuestions.forEach((q) => {
        catCounts[q.category] = (catCounts[q.category] || 0) + 1;
      });
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      if (topCat === 'system-design') {
        focus = 'Architecture, Scalability & System Design';
      } else if (topCat === 'behavioural') {
        focus = 'Behavioral Scenarios, STAR Stories & Culture';
      } else if (topCat === 'company-fit') {
        focus = 'Company Mission, Values & Domain Alignment';
      } else {
        focus = 'Deep Technical Practice & Problem Solving';
      }
    }

    // Integer minutes: 20 minutes per question, bounded between 45 and 120 minutes
    const calculatedMinutes = Math.min(120, Math.max(45, Math.round(dayQuestions.length * 20)));

    return {
      day: dayNum,
      focus,
      question_ids: qIds,
      minutes: calculatedMinutes,
    };
  });

  return {
    days_available: totalDays,
    days,
  };
}
