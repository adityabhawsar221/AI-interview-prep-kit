import React, { useState } from 'react';
import { Trash2, Edit3, Check, RotateCw, Tag } from 'lucide-react';
import { Flashcard } from '../types';

interface Props {
  flashcard: Flashcard;
  onUpdate: (updates: Partial<Flashcard>) => void;
  onDelete: () => void;
}

export const FlashcardCard: React.FC<Props> = ({ flashcard, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [frontDraft, setFrontDraft] = useState(flashcard.front);
  const [backDraft, setBackDraft] = useState(flashcard.back);

  const handleSave = () => {
    onUpdate({ front: frontDraft.trim(), back: backDraft.trim() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFrontDraft(flashcard.front);
    setBackDraft(flashcard.back);
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all shadow-2xs group">
      {/* Top Controls */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
            {flashcard.id}
          </span>
          {flashcard.origin === 'manual' && (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Manual
            </span>
          )}
          {flashcard.origin === 'edited' && (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
              Edited
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                title="Flip to preview answer"
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>{isFlipped ? 'Show Front' : 'Flip to Answer'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Edit flashcard inline"
                aria-label="Edit flashcard"
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onDelete}
            title="Delete flashcard"
            aria-label="Delete flashcard"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content (Editable or Card Preview) */}
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Front (Prompt / Question / Concept)
            </label>
            <textarea
              rows={2}
              value={frontDraft}
              onChange={(e) => setFrontDraft(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Back (Key Answer Points / Takeaways)
            </label>
            <textarea
              rows={3}
              value={backDraft}
              onChange={(e) => setBackDraft(e.target.value)}
              className="w-full text-xs font-normal bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1 shadow-2xs"
            >
              <Check className="w-3 h-3" /> Save
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="cursor-pointer min-h-[110px] flex flex-col justify-center"
        >
          {!isFlipped ? (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">
                Prompt / Concept:
              </span>
              <h4 className="text-sm font-bold text-slate-900 leading-relaxed hover:text-indigo-600 transition-colors">
                {flashcard.front}
              </h4>
            </div>
          ) : (
            <div className="bg-slate-50 p-3 rounded-xl border border-indigo-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">
                Key Answer Takeaways:
              </span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-normal">
                {flashcard.back}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer Tags & Confidence */}
      <div className="mt-4 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1 font-mono text-[10px]">
          <Tag className="w-3 h-3 text-slate-400" />
          {flashcard.requirement_ids && flashcard.requirement_ids.length > 0
            ? flashcard.requirement_ids.join(', ')
            : 'general'}
        </span>

        {flashcard.confidence && (
          <span
            className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${
              flashcard.confidence === 3
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : flashcard.confidence === 2
                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
            }`}
          >
            {flashcard.confidence === 3 ? 'Mastered' : flashcard.confidence === 2 ? 'Uncertain' : 'Needs Review'}
          </span>
        )}
      </div>
    </div>
  );
};
