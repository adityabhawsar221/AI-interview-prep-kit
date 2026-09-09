import { useState, useCallback } from 'react';
import { KitData, Question, Flashcard, QuestionCategory } from '../types';
import { api } from '../services/api';

export function useKitState(initialKit: KitData, kitId: string) {
  const [kit, setKit] = useState<KitData>(() => ({
    ...initialKit,
    flashcards: initialKit.flashcards || [],
    questions: initialKit.questions || [],
  }));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit Question Prompt or Outline
  const updateQuestion = useCallback(
    (questionId: string, updates: Partial<Question>) => {
      setKit((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId
            ? { ...q, ...updates, origin: q.origin === 'manual' ? 'manual' : 'edited' }
            : q
        ),
      }));
      setHasUnsavedChanges(true);
    },
    []
  );

  // Toggle Pin on Question
  const togglePinQuestion = useCallback((questionId: string) => {
    setKit((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId ? { ...q, is_pinned: !q.is_pinned } : q
      ),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Delete Question
  const deleteQuestion = useCallback((questionId: string) => {
    setKit((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
      // Also remove question from schedule
      schedule: {
        ...prev.schedule,
        days: prev.schedule.days.map((d) => ({
          ...d,
          question_ids: d.question_ids.filter((id) => id !== questionId),
        })),
      },
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Move Question Up/Down within its category
  const moveQuestionOrder = useCallback(
    (questionId: string, direction: 'up' | 'down') => {
      setKit((prev) => {
        const targetQ = prev.questions.find((q) => q.id === questionId);
        if (!targetQ) return prev;

        const categoryQuestions = prev.questions.filter(
          (q) => q.category === targetQ.category
        );
        const idx = categoryQuestions.findIndex((q) => q.id === questionId);
        if (
          (direction === 'up' && idx === 0) ||
          (direction === 'down' && idx === categoryQuestions.length - 1)
        ) {
          return prev;
        }

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const temp = categoryQuestions[idx];
        categoryQuestions[idx] = categoryQuestions[swapIdx];
        categoryQuestions[swapIdx] = temp;

        // Reconstruct full questions array
        let cIdx = 0;
        const reordered = prev.questions.map((q) => {
          if (q.category === targetQ.category) {
            return categoryQuestions[cIdx++];
          }
          return q;
        });

        return { ...prev, questions: reordered };
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  // Move Question to another Category
  const changeQuestionCategory = useCallback(
    (questionId: string, newCategory: QuestionCategory) => {
      setKit((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId
            ? { ...q, category: newCategory, origin: q.origin === 'manual' ? 'manual' : 'edited' }
            : q
        ),
      }));
      setHasUnsavedChanges(true);
    },
    []
  );

  // Add Question Manually
  const addQuestion = useCallback(
    (category: QuestionCategory, prompt: string, answer_outline: string, difficulty: 1 | 2 | 3) => {
      setKit((prev) => {
        const maxNum = prev.questions.reduce((max, q) => {
          const n = parseInt(q.id.replace(/\D/g, ''), 10);
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const newId = `q${maxNum + 1}`;

        const newQ: Question = {
          id: newId,
          category,
          prompt,
          answer_outline,
          difficulty,
          requirement_ids: prev.role.requirements.length > 0 ? [prev.role.requirements[0].id] : [],
          origin: 'manual',
          is_pinned: true,
        };

        // Also add to day 1 of schedule
        const updatedDays = prev.schedule.days.map((d, idx) =>
          idx === 0 ? { ...d, question_ids: [...d.question_ids, newId] } : d
        );

        return {
          ...prev,
          questions: [...prev.questions, newQ],
          schedule: {
            ...prev.schedule,
            days: updatedDays,
          },
        };
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  // Edit Company Brief
  const updateBrief = useCallback((summary: string, what_they_do: string) => {
    setKit((prev) => ({
      ...prev,
      company_brief: {
        ...prev.company_brief,
        summary,
        what_they_do,
      },
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Edit Flashcard
  const updateFlashcard = useCallback((cardId: string, updates: Partial<Flashcard>) => {
    setKit((prev) => ({
      ...prev,
      flashcards: (prev.flashcards || []).map((f) =>
        f.id === cardId ? { ...f, ...updates, origin: f.origin === 'manual' ? 'manual' : 'edited' } : f
      ),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Delete Flashcard
  const deleteFlashcard = useCallback((cardId: string) => {
    setKit((prev) => ({
      ...prev,
      flashcards: (prev.flashcards || []).filter((f) => f.id !== cardId),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Add Flashcard
  const addFlashcard = useCallback((front: string, back: string) => {
    setKit((prev) => {
      const existingCards = prev.flashcards || [];
      const maxNum = existingCards.reduce((max, f) => {
        const n = parseInt(f.id.replace(/\D/g, ''), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const newCard: Flashcard = {
        id: `f${maxNum + 1}`,
        front,
        back,
        requirement_ids: prev.role.requirements.length > 0 ? [prev.role.requirements[0].id] : [],
        origin: 'manual',
        is_pinned: true,
      };
      return {
        ...prev,
        flashcards: [...existingCards, newCard],
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  // Save to Server
  const saveKit = async () => {
    setIsSaving(true);
    try {
      await api.updateKit(kitId, kit);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Regenerate Section with Preservation Guarantee
  const regenerateSection = async (
    section: 'company_brief' | 'category' | 'schedule' | 'flashcards',
    targetCategory?: string
  ) => {
    setIsRegenerating(true);
    try {
      // First save local changes if any so preservation metadata is current
      if (hasUnsavedChanges) {
        await api.updateKit(kitId, kit);
      }
      const updatedKit = await api.regenerateSection(kitId, section, targetCategory);
      setKit({
        ...updatedKit.data,
        flashcards: updatedKit.data.flashcards || [],
        questions: updatedKit.data.questions || [],
      });
      setHasUnsavedChanges(false);
    } catch (err: any) {
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  return {
    kit,
    setKit,
    hasUnsavedChanges,
    isSaving,
    isRegenerating,
    saveSuccess,
    updateQuestion,
    togglePinQuestion,
    deleteQuestion,
    moveQuestionOrder,
    changeQuestionCategory,
    addQuestion,
    updateBrief,
    updateFlashcard,
    deleteFlashcard,
    addFlashcard,
    saveKit,
    regenerateSection,
  };
}
