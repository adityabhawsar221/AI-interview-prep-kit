import { generateStructured } from './geminiClient.js';
import { Requirement, Question } from './schema.js';
import { isInvalidRequirementText } from './extractor.js';

export type QuestionCategory = 'technical' | 'behavioural' | 'system-design' | 'company-fit';

interface RawCategoryQuestion {
  requirement_ids: string[];
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
}

/**
 * Safeguard C: Verifies whether a requirement is interview-worthy.
 * Rejects metadata, employment type, location strings, company boilerplate, and non-interviewable items.
 */
export function isInterviewableRequirement(req: Requirement, companyName?: string): boolean {
  if (!req || !req.text) return false;
  return !isInvalidRequirementText(req.text, { companyName });
}

/**
 * Calibrates question difficulty according to role seniority:
 * - Junior / Associate: mostly 1–2
 * - Mid-Level: balanced mixture of 1–3
 * - Senior / Staff: mostly 2–3
 */
export function calibrateDifficulty(seniority: string, requestedDiff: number, index: number): 1 | 2 | 3 {
  const norm = (seniority || '').toLowerCase();
  const isJunior = /junior|associate|entry|intern/i.test(norm);
  const isSenior = /senior|lead|staff|principal|architect/i.test(norm);

  if (isJunior) {
    return index % 2 === 0 ? 1 : 2;
  }
  if (isSenior) {
    return index % 3 === 0 ? 2 : (index % 3 === 1 ? 3 : 2);
  }
  const cycle: (1 | 2 | 3)[] = [1, 2, 2, 3];
  return cycle[index % cycle.length];
}

/**
 * Checks if a question prompt matches banned repetitive templates.
 */
export function isBannedRepetitiveTemplate(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (lower.includes('applied') && lower.includes('critical challenges') && lower.includes('production')) {
    return true;
  }
  if (lower.includes('solve critical challenges or optimize performance in production')) {
    return true;
  }
  return false;
}

const SYSTEM_INSTRUCTION_PREFIX = `You are an expert technical interviewer and instructional designer. Your task is to generate realistic interview questions for a candidate based strictly on the provided company context, documented interview signals, and specific job requirement.

CRITICAL LINGUISTIC CONSTRAINTS:
1. Question Phrasing (\`prompt\`): Write in extremely simple, easy-to-understand English.
2. Answer Phrasing (\`answer_outline\`): Write using plain, non-native, international English. Use short sentences, basic vocabulary, and standard grammar. Strictly avoid idioms, regional slang, metaphors, or complex academic phrasing.
3. Assign a difficulty level (1, 2, or 3).`;

const CATEGORY_PROMPTS: Record<QuestionCategory, { instruction: string; focus: string }> = {
  technical: {
    instruction: `${SYSTEM_INSTRUCTION_PREFIX}
Focus: Assess technical fundamentals, code mechanisms, and concrete debugging.
The questions must directly test technical skills from the provided requirements.

QUESTION VARIETY RULES (NEVER use repetitive templates):
1. "What is [concept] and how does it work?"
2. "What is the difference between [concept A] and [concept B] in [tech]?"
3. "How would you implement [specific task] using [tech]?"
4. "How do you find and fix bugs in [tech]?"
5. "What are the advantages and disadvantages of using [tech]?"

STRICT PROHIBITIONS:
- NEVER use the repetitive template: "How have you applied X to solve critical challenges or optimize performance in production?".
- NEVER generate questions from company marketing, mission statements, or job headings.
- NEVER generate questions from employment type, location, benefits, or metadata.

STRICT ANSWER OUTLINE RULES:
- Format as 3 to 5 clear bullet points starting with "• ".
- Use plain, non-native, international English with short sentences and simple words.`,
    focus: 'Technical fundamentals, code mechanisms, and concrete debugging.',
  },
  behavioural: {
    instruction: `${SYSTEM_INSTRUCTION_PREFIX}
Focus: Assess team communication, handling problems, and work ownership.
Generate behavioral questions based on collaboration and responsibility.

QUESTION VARIETY RULES:
- "Tell me about a time you had a technical disagreement with a coworker. How did you resolve it?"
- "Describe a situation where a system broke in production. What did you do to fix it?"
- "How do you organize your work when you have multiple urgent tasks?"
- "What do you do if you find a mistake in your previous code?"

STRICT ANSWER OUTLINE RULES:
- Format as 3 to 4 clear bullet points starting with "• ".
- Outline simple STAR steps: Situation, Task, Action taken, Result achieved.
- Use plain, short sentences with standard vocabulary.`,
    focus: 'Team communication, handling problems, and work ownership.',
  },
  'system-design': {
    instruction: `${SYSTEM_INSTRUCTION_PREFIX}
Focus: Assess architecture, database choices, and system design matching seniority.

SENIORITY GROUNDING:
- Junior: Focus on simple component design, basic REST APIs, and client-side storage.
- Mid-Level: Focus on REST/GraphQL APIs, database tables, indexes, and basic caching.
- Senior: Focus on scaling, asynchronous worker queues, database partitioning, and fault tolerance.

QUESTION VARIETY:
- "How would you design a simple API service for [use case]?"
- "How would you store and query user data for this feature?"
- "What steps would you take if the server slows down under heavy load?"

STRICT ANSWER OUTLINE RULES:
- Format as 3 to 5 clear bullet points starting with "• ".
- Outline simple architectural components: API layer, database choice, caching, and error handling.`,
    focus: 'System architecture, database design, and scalability.',
  },
  'company-fit': {
    instruction: `${SYSTEM_INSTRUCTION_PREFIX}
Focus: Assess candidate interest in the company and their motivation.

QUESTION VARIETY:
- "Why do you want to work at [Company]?"
- "What interests you about [Company]'s product and mission?"
- "How do your previous technical experiences help [Company] achieve its goals?"

STRICT ANSWER OUTLINE RULES:
- Format as 3 to 4 clear bullet points starting with "• ".
- Reference real details about what the company builds using plain English.`,
    focus: 'Company mission alignment, product domain interest, and motivation.',
  },
};

/**
 * Synthesizes a realistic, high-quality, technically rich interview question
 * tailored dynamically to ANY requirement topic and target category.
 * Fully supports Java, Spring Boot, Python, Go, C++, MERN, Kubernetes, and dynamic tech stacks.
 */
export function synthesizeDomainQuestion(
  requirementText: string,
  category: QuestionCategory,
  roleTitle: string,
  companyName: string,
  seniority = 'Mid-Level',
  index = 0
): { prompt: string; answer_outline: string; difficulty: 1 | 2 | 3 } {
  const lower = requirementText.toLowerCase();

  // 1. Behavioural questions
  if (category === 'behavioural') {
    const behPrompts = [
      {
        prompt: `Tell me about a time you had a technical disagreement or challenging production issue regarding ${requirementText}. How did you navigate the situation and resolve it?`,
        outline:
          '• Situation: Clarify the disagreement or production challenge calmly, focusing on system requirements and constraints\n• Action: Built minimal proof-of-concept prototypes, benchmarked alternatives, and aligned with stakeholders\n• Resolution: Made a data-driven consensus decision aligned with team velocity and reliability\n• Result: Delivered the solution on schedule with strong team alignment and zero production regressions',
      },
      {
        prompt: `Describe a high-stakes project involving ${requirementText} where requirements or deadlines shifted suddenly. How did you manage priorities and deliver?`,
        outline:
          '• Situation: High-priority initiative with aggressive timelines and evolving scope\n• Action: Ruthlessly prioritized must-have core functionality and communicated trade-offs with stakeholders\n• Execution: Maintained rigorous automated test coverage on critical paths rather than accumulating tech debt\n• Result: Met the deadline successfully with zero post-launch incidents and high stakeholder trust',
      },
    ];
    const picked = behPrompts[index % behPrompts.length];
    return {
      prompt: picked.prompt,
      answer_outline: picked.outline,
      difficulty: 2,
    };
  }

  // 2. Company Fit questions
  if (category === 'company-fit') {
    return {
      prompt: `Why do you want to join ${companyName}, and how does your hands-on background in ${requirementText} position you to make an impact here?`,
      answer_outline:
        `• Demonstrates clear understanding of ${companyName}'s product mission, architecture, and ambitious goals\n• Connects hands-on experience in ${requirementText} directly to current engineering challenges\n• Shows strong ownership mentality, high standards for engineering excellence, and bias for action\n• Articulates long-term excitement to collaborate with a small, elite team delivering high-impact solutions`,
      difficulty: 2,
    };
  }

  // 3. Java & Spring Boot / Enterprise Backend
  if (
    lower.includes('java') ||
    lower.includes('spring') ||
    lower.includes('hibernate') ||
    lower.includes('jpa') ||
    lower.includes('jvm')
  ) {
    if (category === 'system-design') {
      return {
        prompt:
          'How would you architect a resilient microservices backend using Java and Spring Boot with distributed transactions and asynchronous event messaging?',
        answer_outline:
          '• Implement the Saga pattern with compensating transactions for multi-service data consistency\n• Decouple inter-service communication using Apache Kafka or RabbitMQ with exponential retry topics\n• Configure circuit breakers (Resilience4j) on synchronous REST calls to prevent cascading downstream failures\n• Enforce distributed tracing across services using OpenTelemetry and Spring Cloud Sleuth',
        difficulty: 3,
      };
    }
    return {
      prompt:
        'In a Spring Boot application, how do you manage database transaction isolation levels with JPA/Hibernate, and how do you diagnose N+1 queries and JVM memory leaks?',
      answer_outline:
        '• Use @Transactional with explicit propagation and isolation levels to prevent dirty reads and lost updates\n• Detect N+1 query patterns using Hibernate SQL logging and eliminate them using JOIN FETCH or @EntityGraph\n• Configure HikariCP connection pool settings (maximumPoolSize, connectionTimeout) to avoid thread exhaustion\n• Capture and analyze JVM heap dumps using tools like Eclipse Memory Analyzer (MAT) to trace object retention paths',
      difficulty: 2,
    };
  }

  // 2. Python & Modern Backend / Data
  if (
    lower.includes('python') ||
    lower.includes('django') ||
    lower.includes('fastapi') ||
    lower.includes('celery') ||
    lower.includes('flask')
  ) {
    if (category === 'system-design') {
      return {
        prompt:
          'How do you design a high-throughput API platform in Python using FastAPI, asynchronous task workers, and distributed caching to handle heavy traffic bursts?',
        answer_outline:
          '• Use FastAPI with Uvicorn ASGI workers for non-blocking asynchronous request handling\n• Offload CPU-heavy operations to Celery background task workers backed by Redis or RabbitMQ brokers\n• Cache expensive database queries and computed aggregations in Redis with time-to-live (TTL) invalidation\n• Scale application instances horizontally behind a load balancer with containerized Docker deployments',
        difficulty: 3,
      };
    }
    return {
      prompt:
        'How does Python handle asynchronous I/O with asyncio, what are the architectural trade-offs of the Global Interpreter Lock (GIL), and how do you optimize ORM queries?',
      answer_outline:
        '• asyncio utilizes an event loop for concurrent network I/O without the overhead of heavy OS threads\n• The GIL restricts pure Python bytecode execution to one thread per process; use multiprocessing for CPU-bound tasks\n• Optimize ORM queries using select_related for foreign keys and prefetch_related for many-to-many relationships\n• Enforce strict schema validation and serialization at API boundaries using Pydantic models',
      difficulty: 2,
    };
  }

  // 3. Go / Golang & High-Performance Systems
  if (lower.includes('golang') || lower.includes('go ') || lower.includes('grpc')) {
    if (category === 'system-design') {
      return {
        prompt:
          'How would you design a distributed gRPC microservices architecture in Go with connection pooling, load balancing, and graceful shutdown?',
        answer_outline:
          '• Utilize gRPC over HTTP/2 for low-latency, binary Protobuf multiplexing across internal services\n• Implement client-side round-robin load balancing and connection pooling to avoid socket re-negotiation\n• Handle OS interrupt signals with context cancellation to allow in-flight requests to complete before termination\n• Enforce strict deadline propagation across RPC chains using Go context.Context',
        difficulty: 3,
      };
    }
    return {
      prompt:
        'How do goroutines, channels, and the Go runtime scheduler manage concurrency, and how do you prevent goroutine leaks and race conditions in production?',
      answer_outline:
        '• The Go M:N scheduler multiplexes thousands of lightweight goroutines onto OS threads using work-stealing\n• Use buffered channels and select blocks with context.WithTimeout to prevent blocked, permanently leaked goroutines\n• Protect shared memory using sync.Mutex or sync.RWMutex and run automated tests with the -race detector flag\n• Bound concurrency on worker pools to prevent unbounded memory growth under sudden traffic spikes',
      difficulty: 2,
    };
  }

  // 4. Kafka & Distributed Event Streaming
  if (
    lower.includes('kafka') ||
    lower.includes('event streaming') ||
    lower.includes('rabbitmq') ||
    lower.includes('pub/sub') ||
    lower.includes('message queue')
  ) {
    return {
      prompt:
        'In an event-driven architecture using Kafka, how do you manage partition key distribution, ensure message ordering, and guarantee delivery semantics?',
      answer_outline:
        '• Choose partition keys aligned with business entity IDs to ensure all events for an entity land on the same partition\n• Configure transactional producers (enable.idempotence=true) and manual consumer offset commits for reliable processing\n• Route permanently failing messages to a Dead-Letter Queue (DLQ) after bounded exponential retries\n• Monitor consumer group lag metrics using Prometheus to trigger horizontal autoscaling of consumer worker pods',
      difficulty: 3,
    };
  }

  // 5. Relational Databases & SQL Optimization
  if (
    lower.includes('postgresql') ||
    lower.includes('postgres') ||
    lower.includes('mysql') ||
    (lower.includes('sql') && !lower.includes('nosql')) ||
    lower.includes('database optimization')
  ) {
    return {
      prompt:
        'How do you analyze slow query execution plans using EXPLAIN ANALYZE in PostgreSQL or MySQL, and how do you design compound indexes for multi-column filtering and sorting?',
      answer_outline:
        '• Inspect EXPLAIN ANALYZE for sequential scans, nested loop joins, and sort operations spilling to temporary disk\n• Order compound index columns using the Equality-Range-Sort (ERS) rule to maximize index selectivity\n• Implement connection pooling (e.g. PgBouncer) to prevent connection overhead and CPU context switching\n• Partition high-volume tables by time range or tenant ID to maintain query performance and simplify data retention',
      difficulty: 2,
    };
  }

  // 6. Kubernetes, Cloud & Infrastructure as Code
  if (
    lower.includes('kubernetes') ||
    lower.includes('k8s') ||
    lower.includes('terraform') ||
    lower.includes('cloud') ||
    lower.includes('aws') ||
    lower.includes('gcp')
  ) {
    if (category === 'system-design') {
      return {
        prompt:
          'How do you design a zero-downtime deployment strategy on Kubernetes using Helm and Terraform, and how do you configure resource quotas, Pod Disruption Budgets, and Horizontal Pod Autoscaling?',
        answer_outline:
          '• Define RollingUpdate deployment strategies with appropriate maxSurge and maxUnavailable thresholds\n• Configure readiness and liveness probes accurately to prevent premature traffic routing to unready pods\n• Enforce Pod Disruption Budgets (PDB) to maintain service availability during node upgrades and drain operations\n• Manage infrastructure as code with Terraform state locking in S3/DynamoDB and CI/CD automated plan reviews',
        difficulty: 3,
      };
    }
    return {
      prompt:
        'How do you structure a multi-stage Dockerfile for a production application to minimize image size, ensure reproducibility, and harden security?',
      answer_outline:
        '• Separate build dependencies and compilation steps from the minimal production Alpine runtime image\n• Run the application process under a non-privileged user to mitigate container escape risks\n• Maximize Docker layer cache efficiency by copying package and lockfiles prior to source code\n• Integrate automated static vulnerability scanning and linting checks in the CI pipeline',
      difficulty: 2,
    };
  }

  // 7. MERN Stack (MongoDB, Express, React, Node.js)
  if (
    lower.includes('mern') ||
    (lower.includes('react') && lower.includes('node')) ||
    (lower.includes('mongo') && lower.includes('express'))
  ) {
    if (category === 'system-design') {
      return {
        prompt:
          'How would you architect a production MERN application to handle 10,000 concurrent active users without database bottlenecks?',
        answer_outline:
          '• Introduce a Redis caching tier in front of MongoDB for high-frequency, read-heavy query patterns\n• Decouple long-running operations from the Node.js event loop using an asynchronous worker queue (e.g., BullMQ)\n• Serve React static frontend assets via a global CDN and place Node.js API services behind a reverse proxy (Nginx or ALB)\n• Configure MongoDB replica sets with read-preference secondary for reporting and non-critical queries',
        difficulty: 3,
      };
    }
    return {
      prompt:
        'In a production MERN application, how do you manage MongoDB connection pooling, optimize aggregation pipelines, and synchronize state with React?',
      answer_outline:
        '• Configure Mongoose connection poolSize and monitor socket reuse to avoid connection exhaustion under traffic spikes\n• Utilize compound indexes, projection, and lean() queries to minimize MongoDB query latency below 50ms\n• Structure Express middleware for centralized validation, JWT authentication, and structured error responses\n• Manage React client state with optimistic updates and rollback mechanisms on API errors for smooth user experience',
      difficulty: 2,
    };
  }

  // 8. TypeScript
  if (lower.includes('typescript') || lower.includes('ts ')) {
    return {
      prompt:
        "What are the core differences between 'type' and 'interface' in TypeScript, and how do you implement discriminated unions for type-safe API boundary handling?",
      answer_outline:
        "• Interfaces support declaration merging; types support primitives, union types, and complex conditional or mapped types\n• Discriminated unions enforce exhaustive compile-time checking using a common literal discriminator tag\n• Validate runtime API boundaries using schema validation libraries (e.g. Zod) rather than unsafe type casting ('as')\n• Leverage generics with extends constraints (<T extends Record<string, unknown>>) to build reusable service handlers",
      difficulty: 2,
    };
  }

  // 9. AI / Multi-Agent Workflows
  if (
    lower.includes('agent') ||
    lower.includes('langchain') ||
    lower.includes('langgraph') ||
    lower.includes('crewai') ||
    lower.includes('orchestration') ||
    lower.includes('ai workflow')
  ) {
    if (category === 'system-design') {
      return {
        prompt:
          'How do you design a scalable production platform for executing asynchronous AI agent workflows with human-in-the-loop validation?',
        answer_outline:
          '• Use an event-driven task queue (e.g., Temporal or BullMQ) to pause agent execution state awaiting human review\n• Stream intermediate token generations and agent thought steps to clients using Server-Sent Events (SSE) or WebSockets\n• Implement strict token rate-limiting, budget tracking, and caching of intermediate LLM prompts\n• Isolate agent tool sandbox execution in ephemeral containers to protect internal infrastructure from untrusted code',
        difficulty: 3,
      };
    }
    return {
      prompt:
        'How do you architect multi-agent workflows using LangGraph or CrewAI, and how do you manage shared state, short-term memory, and tool execution failures?',
      answer_outline:
        '• Define cyclic graph state schemas in LangGraph with explicit state channels for inter-agent communication\n• Implement rolling context window memory and persistent vector store retrieval for long-term agent recall\n• Enforce strict JSON schemas for tool execution with automated retry policies and exponential backoff\n• Configure recursion limits, timeout guards, and fallback models to prevent runaway agent execution loops',
      difficulty: 3,
    };
  }

  // 10. Dynamic Universal Technical Fallback for ANY stack (e.g. C++, Rust, mobile, specialized libraries)
  if (category === 'system-design') {
    return {
      prompt: `How would you architect a scalable, fault-tolerant production service built around ${requirementText} to handle sudden traffic surges while meeting strict latency SLAs?`,
      answer_outline:
        `• Design decoupled service layers with clear interface contracts and defensive boundaries around ${requirementText}\n• Implement distributed caching, read-replicas, and asynchronous background queues to alleviate primary bottlenecks\n• Establish comprehensive health checks, rate limiting, and circuit breaking to gracefully degrade under duress\n• Enforce automated observability with structured metrics, distributed tracing, and automated canary deployments`,
      difficulty: 3,
    };
  }

  return {
    prompt: `When implementing ${requirementText} in a mission-critical production environment, what are the primary performance trade-offs, state consistency considerations, and testing strategies you employ?`,
    answer_outline:
      `• Identify key operational trade-offs: latency vs throughput, simplicity vs flexibility, and consistency vs availability\n• Ensure clean component interfaces and modular boundaries around ${requirementText} to facilitate testing and refactoring\n• Implement proactive error handling, graceful degradation, and structured logging for production triage\n• Verify implementation using automated unit, integration, and load testing prior to release`,
    difficulty: calibrateDifficulty(seniority, 2, index),
  };
}

/**
 * Generates questions for a single category, strictly referencing existing requirement IDs.
 */
export async function generateQuestionsForCategory(
  category: QuestionCategory,
  requirements: Requirement[],
  roleTitle: string,
  companyName: string,
  startQuestionNumber: number,
  companyContext?: string,
  seniority = 'Mid-Level',
  options?: { customApiKey?: string },
  interviewSignals?: string
): Promise<Question[]> {
  const meta = CATEGORY_PROMPTS[category];

  // Safeguard C: Question Generation Guard - filter out any metadata or non-interviewable items
  const validRequirements = requirements
    .filter((r) => isInterviewableRequirement(r, companyName))
    .filter((r) => r.text && r.text.trim().length > 3);

  const activeReqs =
    validRequirements.length > 0
      ? validRequirements
      : [{ id: 'r1', text: `${roleTitle} core software engineering`, kind: 'technical' as const, priority: 'must' as const }];

  const reqIdList = activeReqs
    .map((r) => `${r.id} (${r.priority}, ${r.kind}): "${r.text}"`)
    .join('\n');
  const validIds = new Set(activeReqs.map((r) => r.id));

  const prompt = `
INPUT:
Role: ${roleTitle} (${seniority})
Company: ${companyName}
Category: ${category}
${companyContext ? `Company Context: ${companyContext}\n` : ''}${
    interviewSignals ? `Documented Company Interview Process & Public Discussion Signals:\n${interviewSignals}\nNOTE: Align question styles and focus with this interview format (e.g. if take-home project or system design round was reported, emphasize those competencies).\n` : ''
  }Available Requirements to Test:
${reqIdList}

INSTRUCTIONS:
1. Generate 2 to 3 interview questions testing the candidate on the requirements above.
2. The category must be exactly: "${category}".
3. Write in extremely simple, easy-to-understand English.
4. Write answer outlines using plain, non-native, international English with short sentences and basic vocabulary.
5. Assign a difficulty level (1, 2, or 3) calibrated to ${seniority}.
6. Output ONLY valid JSON matching the exact schema below.

EXPECTED JSON SCHEMA:
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "category": "${category}",
      "prompt": "Simple English question text here...",
      "answer_outline": "• Plain, non-native English bullet points outlining the expected answer...",
      "difficulty": 2
    }
  ]
}
`;

  // Dynamic high-signal fallback in case LLM is unconfigured or offline
  const mockFallback = (): { questions: RawCategoryQuestion[] } => {
    let targetReq: Requirement;
    if (category === 'behavioural') {
      targetReq =
        activeReqs.find((r) => r.kind === 'behavioural' || /debug|incident|lead|team|ship/i.test(r.text)) ||
        activeReqs[0];
    } else if (category === 'system-design') {
      targetReq =
        activeReqs.find((r) => /architect|system|scale|api|pipeline|microservice|infra|database/i.test(r.text)) ||
        activeReqs[0];
    } else if (category === 'company-fit') {
      targetReq = activeReqs[0];
    } else {
      targetReq = activeReqs[startQuestionNumber % activeReqs.length] || activeReqs[0];
    }

    const synthesized = synthesizeDomainQuestion(
      targetReq.text,
      category,
      roleTitle,
      companyName,
      seniority,
      startQuestionNumber
    );

    return {
      questions: [
        {
          requirement_ids: [targetReq.id],
          prompt: synthesized.prompt,
          answer_outline: synthesized.answer_outline,
          difficulty: synthesized.difficulty,
        },
      ],
    };
  };

  const response = await generateStructured<{ questions: RawCategoryQuestion[] }>(
    prompt,
    meta.instruction,
    mockFallback,
    options
  );

  let currentNumber = startQuestionNumber;
  const questions: Question[] = [];

  for (const raw of response.questions || []) {
    let finalPrompt = raw.prompt;
    if (isBannedRepetitiveTemplate(finalPrompt)) {
      const targetReq = activeReqs[0];
      const skill = targetReq ? targetReq.text : roleTitle;
      finalPrompt = `Explain the underlying architecture of ${skill}, and describe how you diagnose and fix common production edge cases.`;
    }

    const filteredReqIds = (raw.requirement_ids || []).filter((id) => validIds.has(id));
    if (filteredReqIds.length === 0 && activeReqs.length > 0) {
      filteredReqIds.push(activeReqs[0].id);
    }

    const assignedDiff = calibrateDifficulty(seniority, Number(raw.difficulty) || 2, currentNumber);

    questions.push({
      id: `q${currentNumber++}`,
      requirement_ids: filteredReqIds,
      category,
      prompt: finalPrompt,
      answer_outline: raw.answer_outline || '• Key architectural principles\n• Concrete trade-offs\n• Verification steps',
      difficulty: assignedDiff,
    });
  }

  return questions;
}

/**
 * Generates the full initial bank of questions across all 4 categories.
 */
export async function generateInitialQuestions(
  requirements: Requirement[],
  roleTitle: string,
  companyName: string,
  companyContext?: string,
  seniority = 'Mid-Level',
  options?: { customApiKey?: string },
  interviewSignals?: string
): Promise<Question[]> {
  const interviewableReqs = requirements.filter((r) => isInterviewableRequirement(r, companyName));
  const activeReqs =
    interviewableReqs.length > 0
      ? interviewableReqs
      : requirements.length > 0
      ? requirements
      : [{ id: 'r1', text: `${roleTitle} core software engineering`, kind: 'technical' as const, priority: 'must' as const }];

  const categories: QuestionCategory[] = ['technical', 'behavioural', 'system-design', 'company-fit'];
  const allQuestions: Question[] = [];

  for (const cat of categories) {
    const questions = await generateQuestionsForCategory(
      cat,
      activeReqs,
      roleTitle,
      companyName,
      allQuestions.length + 1,
      companyContext,
      seniority,
      options,
      interviewSignals
    );
    allQuestions.push(...questions);
  }

  return allQuestions;
}
