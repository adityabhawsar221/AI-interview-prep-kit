import React from 'react';
import { CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { Requirement, Question } from '../types';

interface Props {
  requirements: Requirement[];
  questions: Question[];
  uncoveredMustIds: string[];
  passes: number;
}

export const CoverageBadge: React.FC<Props> = ({
  requirements,
  questions,
  uncoveredMustIds,
  passes,
}) => {
  const mustReqs = requirements.filter((r) => r.priority === 'must');

  const questionReqIdCounts: Record<string, number> = {};
  questions.forEach((q) => {
    (q.requirement_ids || []).forEach((rId) => {
      questionReqIdCounts[rId] = (questionReqIdCounts[rId] || 0) + 1;
    });
  });

  const mustCoveredCount = mustReqs.filter(
    (r) => (questionReqIdCounts[r.id] || 0) > 0
  ).length;

  const mustCoveragePct =
    mustReqs.length === 0 ? 100 : Math.round((mustCoveredCount / mustReqs.length) * 100);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
      {/* Top Coverage Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            {uncoveredMustIds.length === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
            Deterministic Requirement Coverage
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified by code check • {passes} generation {passes === 1 ? 'pass' : 'passes'} executed
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span
              className={`text-lg font-black font-mono ${
                mustCoveragePct === 100 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {mustCoveragePct}%
            </span>
            <span className="text-[10px] text-slate-400 block font-medium">Must-Haves Covered</span>
          </div>

          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
              mustCoveragePct === 100
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {mustCoveredCount}/{mustReqs.length}
          </div>
        </div>
      </div>

      {/* Requirement List */}
      <div className="space-y-2">
        {requirements.map((req) => {
          const qCount = questionReqIdCounts[req.id] || 0;
          const isCovered = qCount > 0;

          return (
            <div
              key={req.id}
              className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 transition-colors ${
                isCovered
                  ? 'border-slate-200/80 bg-slate-50/50 text-slate-700'
                  : req.priority === 'must'
                  ? 'border-amber-300 bg-amber-50/60 text-amber-900'
                  : 'border-slate-200/60 bg-slate-50/30 text-slate-500'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="font-mono font-bold text-[11px] text-indigo-700 shrink-0 mt-0.5 bg-indigo-50 px-1.5 py-0.2 rounded">
                  {req.id}
                </span>
                <div>
                  <p className="font-semibold text-slate-900 leading-relaxed">{req.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        req.priority === 'must'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {req.priority}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">{req.kind}</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                {isCovered ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                    <CheckCircle2 className="w-3 h-3" /> {qCount} {qCount === 1 ? 'q' : 'qs'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                    <ShieldAlert className="w-3 h-3" /> 0 qs
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
