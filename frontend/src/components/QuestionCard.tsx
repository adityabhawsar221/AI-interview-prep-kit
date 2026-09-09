import React, { useState } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pin,
  Trash2,
  Edit3,
  Check,
  Star,
  Tag,
} from 'lucide-react';
import { Question, QuestionCategory } from '../types';

interface Props {
  question: Question;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCategoryChange: (newCat: QuestionCategory) => void;
  onUpdate: (updates: Partial<Question>) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

const CATEGORY_NAMES: Record<QuestionCategory, string> = {
  technical: 'Technical',
  behavioural: 'Behavioral',
  'system-design': 'System Design',
  'company-fit': 'Company Fit',
};

export const QuestionCard: React.FC<Props> = ({
  question,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onCategoryChange,
  onUpdate,
  onTogglePin,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [promptDraft, setPromptDraft] = useState(question.prompt);
  const [outlineDraft, setOutlineDraft] = useState(question.answer_outline);

  const handleSave = () => {
    onUpdate({ prompt: promptDraft, answer_outline: outlineDraft });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setPromptDraft(question.prompt);
    setOutlineDraft(question.answer_outline);
    setIsEditing(false);
  };

  return (
    <div
      className={`rounded-2xl p-5 transition-all border ${
        question.is_pinned
          ? 'border-amber-300 bg-amber-50/50 shadow-xs'
          : 'border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs hover:shadow-xs'
      }`}
    >
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {/* Visual Drag Handle */}
          <span
            title="Drag handle"
            className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5"
          >
            <GripVertical className="w-4 h-4" />
          </span>

          {/* Question ID */}
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
            {question.id}
          </span>

          {/* Origin Badge */}
          {question.origin === 'manual' && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Manual
            </span>
          )}
          {question.origin === 'edited' && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
              Edited
            </span>
          )}

          {/* Category Dropdown */}
          <select
            value={question.category}
            onChange={(e) => onCategoryChange(e.target.value as QuestionCategory)}
            aria-label="Change category"
            className="text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {(Object.keys(CATEGORY_NAMES) as QuestionCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_NAMES[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Difficulty selector */}
          <div className="flex items-center gap-0.5 mr-2" title={`Difficulty: ${question.difficulty} / 3`}>
            {[1, 2, 3].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onUpdate({ difficulty: star as 1 | 2 | 3 })}
                aria-label={`Set difficulty to ${star}`}
                className="p-0.5 hover:scale-110 transition-transform"
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    star <= question.difficulty
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Reorder Buttons */}
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Move Up"
            aria-label="Move question up"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Move Down"
            aria-label="Move question down"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Pin Button */}
          <button
            onClick={onTogglePin}
            title={question.is_pinned ? 'Pinned (survives category regeneration)' : 'Pin question'}
            aria-label="Pin question"
            className={`p-1.5 rounded-lg transition-colors ${
              question.is_pinned
                ? 'text-amber-600 bg-amber-100/70'
                : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            title="Delete question"
            aria-label="Delete question"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content (Notion-like inline edit) */}
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Interview Question / Prompt
            </label>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y min-h-[60px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Answer Outline & Key Points
            </label>
            <textarea
              value={outlineDraft}
              onChange={(e) => setOutlineDraft(e.target.value)}
              className="w-full text-xs font-normal bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y min-h-[90px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Save Edits
            </button>
          </div>
        </div>
      ) : (
        <div className="group relative">
          <div className="flex items-start justify-between gap-3">
            <h4
              onClick={() => setIsEditing(true)}
              title="Click to edit prompt (Notion style)"
              className="text-sm font-bold text-slate-900 leading-snug cursor-pointer hover:text-indigo-600 transition-colors"
            >
              {question.prompt}
            </h4>
            <button
              onClick={() => setIsEditing(true)}
              title="Edit Question & Outline"
              aria-label="Edit question"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-opacity"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            onClick={() => setIsEditing(true)}
            title="Click to edit outline (Notion style)"
            className="mt-3 bg-slate-50/80 hover:bg-slate-50 rounded-xl p-3.5 border border-slate-200/60 cursor-pointer transition-colors"
          >
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
              Target Answer Outline:
            </span>
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-normal">
              {question.answer_outline}
            </p>
          </div>
        </div>
      )}

      {/* Requirement References */}
      {question.requirement_ids && question.requirement_ids.length > 0 && (
        <div className="mt-3.5 pt-2.5 flex items-center gap-1.5 flex-wrap border-t border-slate-100">
          <Tag className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-400">Covers:</span>
          {question.requirement_ids.map((rId) => (
            <span
              key={rId}
              className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60"
            >
              {rId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
