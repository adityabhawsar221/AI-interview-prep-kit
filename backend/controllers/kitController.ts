import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { KitModel, inMemoryKits, InMemoryKit } from '../models/Kit.js';
import { runPipeline } from '../pipeline/runner.js';
import { generateQuestionsForCategory } from '../pipeline/questionGenerator.js';
import { generateCompanyBrief } from '../pipeline/briefGenerator.js';
import { crawlCompanySite } from '../pipeline/crawler.js';
import { buildSchedule } from '../pipeline/scheduler.js';
import { checkCoverage } from '../pipeline/coverage.js';
import { EditableQuestion, EditableFlashcard, WorkingKit } from '../pipeline/schema.js';
import { generateFlashcards } from '../pipeline/flashcardGenerator.js';

interface JobStatus {
  id: string;
  userId: string;
  stage: string;
  percent: number;
  progressMessage?: string;
  status: 'pending' | 'completed' | 'failed';
  kitId?: string;
  error?: string;
}

const activeJobs: Map<string, JobStatus> = new Map();

/**
 * Initiates asynchronous kit generation and returns a jobId for polling.
 */
export async function generateKit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { jd, company_url, days, company_name, api_key } = req.body;
    if (!jd || typeof jd !== 'string' || jd.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Job description (jd) is required.' });
      return;
    }

    const daysNum = Math.max(1, Math.min(60, Number(days) || 5));
    const companyUrl = typeof company_url === 'string' ? company_url.trim() : '';
    const companyName = typeof company_name === 'string' ? company_name.trim() : '';
    const clientApiKey =
      (typeof api_key === 'string' && api_key.trim()) ||
      (req.headers['x-gemini-api-key'] as string) ||
      (req.headers['x-api-key'] as string) ||
      undefined;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const job: JobStatus = {
      id: jobId,
      userId,
      stage: 'initializing',
      percent: 5,
      progressMessage: 'Initializing AI research & generation pipeline...',
      status: 'pending',
    };
    activeJobs.set(jobId, job);

    // Run pipeline asynchronously
    (async () => {
      try {
        const stageDescriptions: Record<string, string> = {
          crawling_site: '🕷️ Crawling company website and discovering public pages...',
          discovering_hiring_page: '📄 Ranking internal links and analyzing hiring handbook...',
          extracting_requirements: '🧠 Extracting candidate requirements with Gemini AI...',
          researching_interviews: '🔍 Searching public interview discussions and rounds...',
          generating_brief: '📝 Synthesizing company brief and interview signals...',
          generating_questions: '⚡ Generating categorized technical & behavioural questions...',
          generating_flashcards: '🃏 Creating interactive concept flashcards...',
          checking_coverage: '🔄 Running Pass 2 coverage loop to close requirement gaps...',
          building_schedule: '📅 Allocating arithmetic day-by-day study schedule...',
          validating: '✅ Validating schema and finalizing prep kit...',
          completed: '🎉 Prep kit generated successfully!',
        };

        const generatedKit = await runPipeline(
          {
            jd,
            company_url: companyUrl,
            days: daysNum,
            company_name: companyName,
            api_key: clientApiKey,
          },
          (stage, percent) => {
            job.stage = stage;
            job.percent = percent;
            job.progressMessage = stageDescriptions[stage] || `Processing stage: ${stage}`;
          }
        );

        if (companyName && !generatedKit.source.company) {
          generatedKit.source.company = companyName;
        }

        // Augment with internal preservation metadata
        const workingData: WorkingKit = {
          ...generatedKit,
          questions: generatedKit.questions.map((q) => ({
            ...q,
            origin: 'generated',
            is_pinned: false,
          })),
          flashcards: generatedKit.flashcards.map((f) => ({
            ...f,
            origin: 'generated',
            is_pinned: false,
          })),
        };

        const isMongoConnected = (mongoose as any).connection?.readyState === 1;
        let savedId = '';

        const effectiveCompany = companyName || workingData.source.company || 'Company';

        if (isMongoConnected) {
          const doc = await KitModel.create({
            userId,
            company: effectiveCompany,
            role: workingData.role.title || 'Role',
            days_available: daysNum,
            source: {
              ...workingData.source,
              company: effectiveCompany,
            },
            company_brief: workingData.company_brief,
            role_data: workingData.role,
            questions: workingData.questions,
            flashcards: workingData.flashcards,
            schedule: workingData.schedule,
            coverage: workingData.coverage,
            data: workingData,
          });
          savedId = doc._id.toString();
        } else {
          savedId = `kit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const memKit: InMemoryKit = {
            id: savedId,
            userId,
            company: effectiveCompany,
            role: workingData.role.title || 'Role',
            days_available: daysNum,
            data: workingData,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryKits.set(savedId, memKit);
        }

        job.status = 'completed';
        job.stage = 'completed';
        job.percent = 100;
        job.kitId = savedId;
      } catch (err: any) {
        job.status = 'failed';
        job.stage = 'failed';
        job.error = err.message || 'Kit generation failed.';
        console.error(`[Kit Generator Error on ${jobId}]:`, err);
      }
    })();

    res.status(202).json({
      success: true,
      message: 'Kit generation started.',
      jobId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to start generation.' });
  }
}

/**
 * Returns current job status for UI polling.
 */
export async function getJobStatus(req: AuthRequest, res: Response): Promise<void> {
  const jobId = String(req.params.jobId);
  const job = activeJobs.get(jobId);

  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found.' });
    return;
  }

  // Ensure user can only poll their own jobs
  if (job.userId !== req.user?.id) {
    res.status(403).json({ success: false, error: 'Access forbidden.' });
    return;
  }

  res.json({
    success: true,
    job: {
      id: job.id,
      stage: job.stage,
      percent: job.percent,
      progressMessage: job.progressMessage || 'Processing preparation kit...',
      status: job.status,
      kitId: job.kitId,
      error: job.error,
    },
  });
}

/**
 * Returns all kits owned by the authenticated user.
 */
export async function getUserKits(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const isMongoConnected = (mongoose as any).connection?.readyState === 1;

    if (isMongoConnected) {
      const docs = await KitModel.find({ userId }).sort({ createdAt: -1 });
      const kits = docs.map((d) => {
        const data = d.data || ({} as any);
        if (!data.flashcards) {
          data.flashcards = d.flashcards || [];
        }
        return {
          id: d._id.toString(),
          company: d.company,
          role: d.role,
          days_available: d.days_available,
          data,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      });
      res.json({ success: true, kits });
      return;
    }

    // In-memory
    const kits = Array.from(inMemoryKits.values())
      .filter((k) => k.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({ success: true, kits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch kits.' });
  }
}

/**
 * Retrieves a single kit by ID, ensuring user ownership.
 */
export async function getKitById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id);

    const isMongoConnected = (mongoose as any).connection?.readyState === 1;

    if (isMongoConnected) {
      const kit = await KitModel.findOne({ _id: id, userId });
      if (!kit) {
        res.status(404).json({ success: false, error: 'Kit not found or access denied.' });
        return;
      }
      const data = kit.data || ({} as any);
      if (!data.flashcards) {
        data.flashcards = kit.flashcards || [];
      }
      res.json({
        success: true,
        kit: {
          _id: kit._id.toString(),
          id: kit._id.toString(),
          company: kit.company,
          role: kit.role,
          days_available: kit.days_available,
          data,
          createdAt: kit.createdAt,
          updatedAt: kit.updatedAt,
        },
      });
      return;
    }

    const memKit = inMemoryKits.get(id);
    if (!memKit || memKit.userId !== userId) {
      res.status(404).json({ success: false, error: 'Kit not found or access denied.' });
      return;
    }

    res.json({ success: true, kit: { ...memKit, _id: memKit.id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch kit.' });
  }
}

/**
 * Updates full kit state (inline edits, additions, deletions, reorders).
 */
export async function updateKit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id);
    const { data } = req.body;

    if (!data) {
      res.status(400).json({ success: false, error: 'Kit data is required.' });
      return;
    }

    const isMongoConnected = (mongoose as any).connection?.readyState === 1;

    if (isMongoConnected) {
      const updated = await KitModel.findOneAndUpdate(
        { _id: id, userId },
        {
          $set: {
            company: data.source?.company || 'Company',
            role: data.role?.title || 'Role',
            days_available: data.schedule?.days_available || 5,
            source: data.source,
            company_brief: data.company_brief,
            role_data: data.role,
            questions: data.questions,
            flashcards: data.flashcards,
            schedule: data.schedule,
            coverage: data.coverage,
            data,
          },
        },
        { new: true }
      );

      if (!updated) {
        res.status(404).json({ success: false, error: 'Kit not found.' });
        return;
      }

      res.json({ success: true, kit: { id: updated._id.toString(), data: updated.data } });
      return;
    }

    const memKit = inMemoryKits.get(id);
    if (!memKit || memKit.userId !== userId) {
      res.status(404).json({ success: false, error: 'Kit not found.' });
      return;
    }

    memKit.data = data;
    memKit.company = data.source?.company || memKit.company;
    memKit.role = data.role?.title || memKit.role;
    memKit.days_available = data.schedule?.days_available || memKit.days_available;
    memKit.updatedAt = new Date();

    res.json({ success: true, kit: memKit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update kit.' });
  }
}

/**
 * Regenerates a single section without losing user edits made elsewhere.
 * Pinned or user-edited/manual items are strictly preserved!
 */
export async function regenerateSection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id);
    const { section, targetCategory } = req.body;

    // Fetch existing kit
    const isMongoConnected = (mongoose as any).connection?.readyState === 1;
    let kitData: WorkingKit | null = null;
    let kitDoc: any = null;

    if (isMongoConnected) {
      kitDoc = await KitModel.findOne({ _id: id, userId });
      if (!kitDoc) {
        res.status(404).json({ success: false, error: 'Kit not found.' });
        return;
      }
      kitData = kitDoc.data;
    } else {
      const memKit = inMemoryKits.get(id);
      if (!memKit || memKit.userId !== userId) {
        res.status(404).json({ success: false, error: 'Kit not found.' });
        return;
      }
      kitData = memKit.data;
    }

    if (!kitData) {
      res.status(404).json({ success: false, error: 'Kit data missing.' });
      return;
    }

    // Handle section types
    if (section === 'company_brief') {
      const crawlResult = await crawlCompanySite(kitData.source.company_url);
      const newBrief = await generateCompanyBrief(
        kitData.source.company,
        crawlResult.pages,
        crawlResult.pages_used
      );
      kitData.company_brief = newBrief;
    } else if (section === 'category') {
      if (!targetCategory) {
        res.status(400).json({ success: false, error: 'targetCategory is required for category regeneration.' });
        return;
      }

      // 1. Extract and PRESERVE user items (edited, manual, or pinned)
      const preservedUserQuestions = kitData.questions.filter(
        (q) =>
          q.category === targetCategory &&
          (q.origin === 'edited' || q.origin === 'manual' || q.is_pinned === true)
      );

      // Keep all questions belonging to OTHER categories intact
      const otherCategoryQuestions = kitData.questions.filter(
        (q) => q.category !== targetCategory
      );

      // 2. Generate fresh questions for this category
      const maxCurrentIdNum = kitData.questions.reduce((max, q) => {
        const num = parseInt(q.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);

      const freshlyGenerated = await generateQuestionsForCategory(
        targetCategory,
        kitData.role.requirements,
        kitData.role.title,
        kitData.source.company,
        maxCurrentIdNum + 1
      );

      const flaggedGenerated: EditableQuestion[] = freshlyGenerated.map((q) => ({
        ...q,
        origin: 'generated',
        is_pinned: false,
      }));

      // Combine preserved user questions with new generated questions
      const mergedCategoryQuestions = [...preservedUserQuestions, ...flaggedGenerated];
      kitData.questions = [...otherCategoryQuestions, ...mergedCategoryQuestions];

      // Re-evaluate coverage
      const coverageReport = checkCoverage(kitData.role.requirements, kitData.questions);
      kitData.coverage.uncovered_requirement_ids = coverageReport.uncovered_must_ids;

      // Update schedule to ensure newly formed question IDs are allocated
      kitData.schedule = buildSchedule(
        kitData.questions,
        kitData.role.requirements,
        kitData.schedule.days_available
      );
    } else if (section === 'schedule') {
      kitData.schedule = buildSchedule(
        kitData.questions,
        kitData.role.requirements,
        kitData.schedule.days_available
      );
    } else if (section === 'flashcards') {
      // Preserve user edits/pins/manual cards
      const preservedUserFlashcards = (kitData.flashcards || []).filter(
        (f) => f.origin === 'edited' || f.origin === 'manual' || f.is_pinned === true
      );

      const generatedCards = await generateFlashcards(
        kitData.role.requirements,
        kitData.questions,
        kitData.role.title
      );

      const maxCurrentIdNum = preservedUserFlashcards.reduce((max, f) => {
        const num = parseInt(f.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);

      let nextIdNum = maxCurrentIdNum + 1;
      const flaggedGenerated: EditableFlashcard[] = generatedCards.map((c) => ({
        ...c,
        id: `f${nextIdNum++}`,
        origin: 'generated',
        is_pinned: false,
      }));

      kitData.flashcards = [...preservedUserFlashcards, ...flaggedGenerated];
    } else {
      res.status(400).json({ success: false, error: `Unsupported section type: ${section}` });
      return;
    }

    // Persist updated kit
    if (isMongoConnected && kitDoc) {
      kitDoc.data = kitData;
      kitDoc.markModified('data');
      await kitDoc.save();
    } else {
      const memKit = inMemoryKits.get(id);
      if (memKit) {
        memKit.data = kitData;
        memKit.updatedAt = new Date();
      }
    }

    res.json({
      success: true,
      message: `Successfully regenerated ${section}.`,
      kit: { id, data: kitData },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Regeneration failed.' });
  }
}

/**
 * Deletes a kit belonging to the authenticated user.
 */
export async function deleteKit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id);

    const isMongoConnected = (mongoose as any).connection?.readyState === 1;
    if (isMongoConnected) {
      await KitModel.deleteOne({ _id: id, userId });
    } else {
      inMemoryKits.delete(id);
    }

    res.json({ success: true, message: 'Kit deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete kit.' });
  }
}
