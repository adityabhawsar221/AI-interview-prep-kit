import React from 'react';
import {
  Globe,
  Compass,
  FileText,
  Search,
  BookOpen,
  HelpCircle,
  Layers,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  {
    id: 'crawling_site',
    label: 'Site Crawl',
    description: 'Fetching company root & checking robots.txt',
    icon: Globe,
  },
  {
    id: 'discovering_hiring_page',
    label: 'Hiring Discovery',
    description: 'Ranking career & handbook pages',
    icon: Compass,
  },
  {
    id: 'extracting_requirements',
    label: 'JD Extraction',
    description: 'Conservative must vs nice extraction',
    icon: FileText,
  },
  {
    id: 'researching_interviews',
    label: 'Interview Signals',
    description: 'Public discussions & interview stages',
    icon: Search,
  },
  {
    id: 'generating_brief',
    label: 'Company Brief',
    description: 'Objective synthesis & verified sources',
    icon: BookOpen,
  },
  {
    id: 'generating_questions',
    label: 'Question Bank',
    description: '4 categorized rounds with bullet outlines',
    icon: HelpCircle,
  },
  {
    id: 'generating_flashcards',
    label: 'Flashcards',
    description: 'Active-recall spaced repetition cards',
    icon: Layers,
  },
  {
    id: 'checking_coverage',
    label: 'Coverage Pass',
    description: 'Deterministic gap replenishment loop',
    icon: CheckCircle2,
  },
  {
    id: 'building_schedule',
    label: 'Study Schedule',
    description: 'Arithmetic timeline allocation (1–60d)',
    icon: Calendar,
  },
  {
    id: 'validating',
    label: 'Appendix A Check',
    description: 'Schema verification',
    icon: ShieldCheck,
  },
];

interface Props {
  currentStage: string;
  percent: number;
}

export const ProgressStepper: React.FC<Props> = ({ currentStage, percent }) => {
  const getStepStatus = (stepId: string) => {
    const stepIdx = STEPS.findIndex((s) => s.id === stepId);
    const currentIdx = STEPS.findIndex((s) => s.id === currentStage);

    if (currentStage === 'completed') return 'completed';
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            Autonomous Pipeline in Progress
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Executing live website research, conservative parsing, and deterministic scheduling
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-indigo-600 font-mono">
            {percent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-6 p-0.5 border border-slate-200/60">
        <div
          className="bg-gradient-to-r from-indigo-600 to-violet-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(5, percent)}%` }}
        />
      </div>

      {/* Step Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {STEPS.map((step) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-2.5 p-3 rounded-2xl border transition-all ${
                status === 'completed'
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                  : status === 'active'
                  ? 'border-indigo-400 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20'
                  : 'border-slate-100 bg-slate-50/70 text-slate-400'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : status === 'active'
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : 'bg-white border border-slate-200 text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate flex items-center gap-1.5">
                  <span>{step.label}</span>
                  {status === 'completed' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                </div>
                <div
                  className={`text-[10px] line-clamp-2 mt-0.5 ${
                    status === 'active' ? 'text-indigo-700' : 'text-slate-500'
                  }`}
                >
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
