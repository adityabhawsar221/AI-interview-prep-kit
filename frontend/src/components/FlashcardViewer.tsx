import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Award,
  Zap,
  Tag,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Flashcard } from '../types';

interface Props {
  flashcards: Flashcard[];
  onConfidenceUpdate: (cardId: string, confidence: 1 | 2 | 3) => void;
  onFinishSession?: () => void;
}

export const FlashcardViewer: React.FC<Props> = ({
  flashcards,
  onConfidenceUpdate,
  onFinishSession,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const card = flashcards[currentIndex];
  const total = flashcards.length;

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (isFlipped && (e.code === 'Digit1' || e.code === 'KeyH')) {
        rateConfidence(1);
      } else if (isFlipped && (e.code === 'Digit2' || e.code === 'KeyG')) {
        rateConfidence(2);
      } else if (isFlipped && (e.code === 'Digit3' || e.code === 'KeyE')) {
        rateConfidence(3);
      } else if (e.code === 'ArrowRight' && currentIndex < total - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.code === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, card, total, isFlipped]);

  const rateConfidence = (rating: 1 | 2 | 3) => {
    if (!card) return;
    onConfidenceUpdate(card.id, rating);
    setCompletedCount((prev) => Math.min(total, prev + 1));

    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
      onFinishSession?.();
    }
  };

  if (!card) {
    return (
      <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl p-10 shadow-xs max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
          <Award className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900">All Flashcards Completed!</h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          You have reviewed all available flashcards in this deck. Your confidence ratings have been recorded for spaced repetition.
        </p>
      </div>
    );
  }

  const coveragePercent = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Sleek Top Coverage Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-900 font-bold">
              Card {currentIndex + 1}
            </span>
            <span className="text-slate-300">/</span>
            <span>{total}</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-600 font-bold font-mono">
            <span>{coveragePercent}%</span>
            <span className="text-slate-400 font-normal">Coverage</span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${coveragePercent}%` }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-r from-indigo-600 to-violet-500 h-full rounded-full"
          />
        </div>
      </div>

      {/* 3D Flip Flashcard */}
      <div
        className="perspective-1000 cursor-pointer min-h-[360px] select-none"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className={`relative w-full min-h-[360px] rounded-3xl p-8 sm:p-12 border bg-white shadow-md hover:shadow-xl transition-shadow transform-style-3d flex flex-col justify-between ${
            isFlipped ? 'border-indigo-300' : 'border-slate-200/90'
          }`}
        >
          {!isFlipped ? (
            /* Front Side (Concept / Question) */
            <div className="flex-1 flex flex-col justify-between backface-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60">
                  {card.id}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <RotateCw className="w-3.5 h-3.5" /> Click or Space to reveal
                </span>
              </div>

              <div className="py-10 my-auto text-center">
                <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block mb-3">
                  Concept / Active Recall Prompt
                </span>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-relaxed">
                  {card.front}
                </p>
              </div>

              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>Target Requirements: {(card.requirement_ids || []).join(', ') || 'General'}</span>
              </div>
            </div>
          ) : (
            /* Back Side (Answer Takeaways) */
            <div className="flex-1 flex flex-col justify-between rotate-y-180 backface-hidden">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60">
                  {card.id}
                </span>
                <span className="font-bold uppercase tracking-wider text-[11px] text-indigo-600">
                  Answer Key & Core Points
                </span>
              </div>

              <div className="py-6 my-auto">
                <div className="bg-slate-50/80 rounded-2xl p-5 border border-indigo-100">
                  <p className="text-sm sm:text-base text-slate-800 whitespace-pre-wrap leading-relaxed font-normal">
                    {card.back}
                  </p>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400 font-medium">
                Rate your confidence below to schedule next review
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Glowing Confidence Buttons: Appear ONLY after the card is flipped! */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            className="mt-8 space-y-3"
          >
            <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rate Recall Confidence:
            </p>

            <div className="grid grid-cols-3 gap-3">
              {/* Hard Button */}
              <button
                onClick={() => rateConfidence(1)}
                className="group flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 shadow-sm shadow-rose-200/40 hover:shadow-rose-300/60 transition-all active:scale-95"
              >
                <span className="text-xs font-black uppercase tracking-wider group-hover:scale-105 transition-transform">
                  Hard
                </span>
                <span className="text-[10px] text-rose-500 mt-0.5">Key 1 / H</span>
              </button>

              {/* Good Button */}
              <button
                onClick={() => rateConfidence(2)}
                className="group flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 shadow-sm shadow-amber-200/40 hover:shadow-amber-300/60 transition-all active:scale-95"
              >
                <span className="text-xs font-black uppercase tracking-wider group-hover:scale-105 transition-transform">
                  Good
                </span>
                <span className="text-[10px] text-amber-600 mt-0.5">Key 2 / G</span>
              </button>

              {/* Easy Button */}
              <button
                onClick={() => rateConfidence(3)}
                className="group flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 shadow-sm shadow-indigo-200/50 hover:shadow-indigo-300/70 transition-all active:scale-95"
              >
                <span className="text-xs font-black uppercase tracking-wider group-hover:scale-105 transition-transform">
                  Easy
                </span>
                <span className="text-[10px] text-indigo-500 mt-0.5">Key 3 / E</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Keyboard Navigation Helpers */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-200/80 text-xs text-slate-400">
        <button
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 font-semibold hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
          Space: Flip • 1/2/3: Rate • ← / →: Skip
        </span>

        <button
          onClick={() => setCurrentIndex((prev) => Math.min(total - 1, prev + 1))}
          disabled={currentIndex === total - 1}
          className="flex items-center gap-1 font-semibold hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
