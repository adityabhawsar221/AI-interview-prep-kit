import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Schedule, Question } from '../types';

interface Props {
  schedule: Schedule;
  questions: Question[];
}

export const ScheduleTimeline: React.FC<Props> = ({ schedule, questions }) => {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const totalMinutes = schedule.days.reduce((sum, d) => sum + d.minutes, 0);

  return (
    <div className="space-y-6">
      {/* Schedule Summary Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {schedule.days_available}-Day Tailored Study Allocation
            </h4>
            <p className="text-xs text-slate-500">
              Distributed deterministically: harder & must-have concepts scheduled first with integer minutes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200/60">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          <span>Total: {totalMinutes} mins (~{(totalMinutes / 60).toFixed(1)} hrs)</span>
        </div>
      </div>

      {/* Days List */}
      <div className="space-y-4">
        {schedule.days.map((day) => (
          <div
            key={day.day}
            className="border border-slate-200/90 bg-white rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all"
          >
            {/* Day Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                  D{day.day}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {day.focus}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <Clock className="w-3 h-3 text-indigo-600" />
                <span>{day.minutes} mins</span>
              </div>
            </div>

            {/* Questions Scheduled for this Day */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Target Questions ({day.question_ids.length}):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {day.question_ids.map((qId) => {
                  const q = questionMap.get(qId);
                  if (!q) {
                    return (
                      <div
                        key={qId}
                        className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-400"
                      >
                        {qId}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={qId}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 hover:bg-slate-100/60 transition-colors"
                    >
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
                        {q.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 line-clamp-2">
                          {q.prompt}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <span className="capitalize">{q.category}</span>
                          <span>•</span>
                          <span>Diff: {q.difficulty}/3</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
