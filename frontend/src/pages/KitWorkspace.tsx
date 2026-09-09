import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles, Building2, Calendar, CheckCircle2, ChevronRight, BookOpen,
  Code2, Clock, Award, Plus, Copy, Check, Layers, CalendarDays,
  Briefcase, Edit3, ArrowLeft, RotateCw, HelpCircle, CheckCircle
} from 'lucide-react';
import { api } from '../services/api';
import { KitRecord, Question, ScheduleDay, Flashcard } from '../types';
import { GenerateKitModal } from '../components/GenerateKitModal';

type CategoryFilter = 'all' | 'technical' | 'behavioural' | 'system-design' | 'company-fit';

export const KitWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [kit, setKit] = useState<KitRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'flashcards' | 'schedule' | 'brief'>('questions');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [cardMastery, setCardMastery] = useState<Record<string, 1 | 2 | 3>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.getKitById(id)
      .then((res) => {
        setKit(res);
        const questionsList = res?.data?.questions || [];
        if (questionsList.length > 0) {
          setSelectedQuestion(questionsList[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to load kit:', err);
        setError(err.message || 'Failed to load interview kit.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Safe helper to extract question prompt
  const getQuestionText = (q: any): string => {
    if (!q) return '';
    return q.prompt || q.question || 'Interview Question';
  };

  // Safe helper to parse answer outline into bullet points
  const getOutlineItems = (outline: any): string[] => {
    if (!outline) return [];
    if (Array.isArray(outline)) return outline.map(String).filter((s) => s.trim().length > 0);
    if (typeof outline === 'string') {
      return outline
        .split(/\n|•|- /)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return [String(outline)];
  };

  const handleCopyAnswer = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveQuestionEdit = async (qId: string) => {
    if (!kit || !kit.data) return;
    const kitId = (kit as any)._id || kit.id;
    const updatedQuestions = (kit.data.questions || []).map((q) =>
      q.id === qId ? { ...q, prompt: editedText } : q
    );
    const updatedData = { ...kit.data, questions: updatedQuestions };
    setKit({ ...kit, data: updatedData });
    if (selectedQuestion?.id === qId) {
      setSelectedQuestion({ ...selectedQuestion, prompt: editedText });
    }
    setEditingQuestionId(null);
    try {
      await api.updateKit(kitId, updatedData);
    } catch (err) {
      console.error('Failed to save question edit:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-[#FCFAF6]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-neutral-700">Loading Interview Kit...</p>
        </div>
      </div>
    );
  }

  if (error || !kit || !kit.data) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-[#FCFAF6]">
        <div className="max-w-md w-full bg-white border border-neutral-200/90 rounded-3xl p-8 text-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-3 text-rose-600">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 mb-1.5">Unable to Load Kit</h2>
          <p className="text-xs text-neutral-500 mb-6">{error || 'Kit data could not be retrieved.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Safely extract all properties with clean fallbacks
  const role = kit.data.role || ({} as any);
  const companyBrief = kit.data.company_brief || ({} as any);
  const questions: Question[] = kit.data.questions || [];
  const flashcards: Flashcard[] = kit.data.flashcards || [];
  const requirements = role.requirements || [];

  // Compute question counts per category
  const categoryCounts = {
    all: questions.length,
    technical: questions.filter((q) => q.category === 'technical').length,
    behavioural: questions.filter((q) => q.category === 'behavioural').length,
    'system-design': questions.filter((q) => q.category === 'system-design').length,
    'company-fit': questions.filter((q) => q.category === 'company-fit').length,
  };

  const filteredQuestions = categoryFilter === 'all'
    ? questions
    : questions.filter((q) => q.category === categoryFilter);

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'technical':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'behavioural':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'system-design':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'company-fit':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  // Safely extract schedule days array
  const scheduleDays: ScheduleDay[] = Array.isArray(kit.data.schedule)
    ? (kit.data.schedule as any)
    : kit.data.schedule?.days || [];
  const daysAvailable =
    kit.data.schedule?.days_available || kit.days_available || scheduleDays.length || 7;

  const targetCompany =
    kit.company || kit.data.source?.company || companyBrief?.name || 'Target Company';
  const roleTitle = role.title || kit.role || 'Target Role';
  const seniority = role.seniority || 'Mid-Senior';

  const selectedOutlinePoints = selectedQuestion
    ? getOutlineItems(selectedQuestion.answer_outline)
    : [];

  const selectedRequirementIds =
    selectedQuestion?.requirement_ids ||
    (selectedQuestion as any)?.must_have_coverage ||
    [];

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#FCFAF6] pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="w-[500px] h-[500px] bg-gradient-to-br from-amber-200/40 via-orange-100/30 to-transparent rounded-full blur-3xl absolute -top-24 -left-24 -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Back Link */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Candidate Dashboard</span>
          </button>
        </div>

        {/* Workspace Header Banner */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100/80 border border-orange-300/60 text-orange-800 text-xs font-bold">
                  <Building2 className="w-3.5 h-3.5 text-orange-600" />
                  <span>Target: {targetCompany}</span>
                </span>
                <span className="text-xs text-neutral-400">•</span>
                <span className="text-xs text-neutral-500 font-medium capitalize">
                  {seniority} Level
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
                {roleTitle}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-2xl">
                Tailored interview preparation covering {requirements.length} core job requirements.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Kit</span>
              </button>
            </div>
          </div>

          {/* Meta & Navigation Tabs */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
            {/* Meta Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-3 py-1 rounded-full bg-neutral-900 text-white font-medium">
                {questions.length} Questions
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                {daysAvailable} Days Plan
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>100% Must-Have Coverage</span>
              </span>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center p-1 bg-neutral-100 rounded-full border border-neutral-200/80 text-xs font-medium flex-wrap">
              <button
                onClick={() => setActiveTab('questions')}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === 'questions'
                    ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Interview Q &amp; A
              </button>
              <button
                onClick={() => setActiveTab('flashcards')}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === 'flashcards'
                    ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Flashcards ({flashcards.length})
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === 'schedule'
                    ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Study Schedule
              </button>
              <button
                onClick={() => setActiveTab('brief')}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === 'brief'
                    ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Company Brief
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Dual-Pane Interview Q&A + Deep Dive */}
        {activeTab === 'questions' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Pane: Questions List */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-500" />
                  <span>Interview Questions ({questions.length})</span>
                </h3>
                <span className="text-xs text-neutral-400">Click to load Deep Dive</span>
              </div>

              {/* Category Filter Sections */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All', count: categoryCounts.all, icon: Layers },
                  { id: 'technical', label: 'Technical', count: categoryCounts.technical, icon: Code2 },
                  { id: 'behavioural', label: 'Behavioral', count: categoryCounts.behavioural, icon: Award },
                  { id: 'system-design', label: 'System Design', count: categoryCounts['system-design'], icon: Briefcase },
                  { id: 'company-fit', label: 'Company Fit', count: categoryCounts['company-fit'], icon: Building2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = categoryFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        const newCat = tab.id as CategoryFilter;
                        setCategoryFilter(newCat);
                        const nextList = newCat === 'all' ? questions : questions.filter((q) => q.category === newCat);
                        if (nextList.length > 0) {
                          if (!selectedQuestion || !nextList.some((q) => q.id === selectedQuestion.id)) {
                            setSelectedQuestion(nextList[0]);
                          }
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                          : 'bg-white text-neutral-600 border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                          isActive ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-neutral-200 text-neutral-400 text-xs">
                  <p className="mb-2 font-medium">No questions in "{categoryFilter}" category.</p>
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className="text-orange-600 font-semibold hover:underline cursor-pointer"
                  >
                    View all questions ({questions.length})
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredQuestions.map((q, idx) => {
                    const isSelected = selectedQuestion?.id === q.id;
                    const isEditing = editingQuestionId === q.id;
                    const qPrompt = getQuestionText(q);
                    const outlinePoints = getOutlineItems(q.answer_outline);

                    return (
                      <div
                        key={q.id}
                        onClick={() => !isEditing && setSelectedQuestion(q)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50/60 border-orange-300 shadow-xs ring-1 ring-orange-200'
                            : 'bg-white border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              Q{idx + 1}
                            </span>

                            <div className="flex-1">
                              {isEditing ? (
                                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                  <textarea
                                    value={editedText}
                                    onChange={(e) => setEditedText(e.target.value)}
                                    className="w-full text-xs p-2 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    rows={2}
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveQuestionEdit(q.id)}
                                      className="px-3 py-1 bg-neutral-900 text-white rounded-md text-[11px] font-semibold cursor-pointer"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingQuestionId(null)}
                                      className="px-2 py-1 text-neutral-500 hover:text-neutral-800 text-[11px] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs sm:text-sm font-bold text-neutral-900 leading-snug">
                                  {qPrompt}
                                </p>
                              )}

                              {/* Outline summary bullets */}
                              {outlinePoints.length > 0 && (
                                <ul className="mt-2.5 space-y-1 text-xs text-neutral-600">
                                  {outlinePoints.slice(0, 2).map((pt, pIdx) => (
                                    <li key={pIdx} className="flex items-start gap-1.5">
                                      <span className="text-orange-500 font-bold">•</span>
                                      <span className="line-clamp-1">{pt}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(q.category)}`}>
                                  {q.category}
                                </span>
                                <span className="text-[10px] font-medium text-neutral-400">
                                  Difficulty: {'★'.repeat(q.difficulty || 2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingQuestionId(q.id);
                                    setEditedText(qPrompt);
                                  }}
                                  className="text-[10px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  <span>Edit</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-1 transition-all ${
                              isSelected
                                ? 'bg-orange-500 text-white shadow-2xs'
                                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Deep Dive</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Pane: Concept Deep Dive & Guide */}
            <div className="lg:col-span-6 bg-white border border-neutral-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs sticky top-22">
              {selectedQuestion ? (
                <>
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                        {selectedQuestion.category} Deep-Dive
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        handleCopyAnswer(
                          typeof selectedQuestion.answer_outline === 'string'
                            ? selectedQuestion.answer_outline
                            : selectedOutlinePoints.join('\n')
                        )
                      }
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Answer'}</span>
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight leading-snug">
                      {getQuestionText(selectedQuestion)}
                    </h3>
                  </div>

                  {/* Answer Outline & Strategy */}
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2.5">
                      Structured Answer Strategy:
                    </h4>
                    {selectedOutlinePoints.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedOutlinePoints.map((point, idx) => (
                          <li key={idx} className="text-xs text-neutral-700 flex items-start gap-2.5">
                            <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{point}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-line">
                        {typeof selectedQuestion.answer_outline === 'string'
                          ? selectedQuestion.answer_outline
                          : 'No outline provided.'}
                      </p>
                    )}
                  </div>

                  {/* Requirements Addressed */}
                  {selectedRequirementIds.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-neutral-400 block mb-2">
                        Requirements Evaluated:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {selectedRequirementIds.map((reqId) => (
                          <span
                            key={reqId}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-orange-100/70 text-orange-800 font-semibold"
                          >
                            {reqId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  Select a question on the left to view the Concept Deep-Dive.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Flashcards Active Recall */}
        {activeTab === 'flashcards' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-100">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    <span>Active Recall Flashcards ({flashcards.length})</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Click any card to flip between the core concept name and its plain, international English explanation.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    {Object.values(cardMastery).filter((m) => m === 3).length} Mastered
                  </span>
                  <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 font-semibold">
                    {flashcards.length} Total Cards
                  </span>
                </div>
              </div>

              {flashcards.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400">
                  No flashcards generated for this kit.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                  {flashcards.map((card, cIdx) => {
                    const isFlipped = !!flippedCards[card.id];
                    const mastery = cardMastery[card.id] || 1;

                    return (
                      <div
                        key={card.id || cIdx}
                        onClick={() =>
                          setFlippedCards((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                        }
                        className={`min-h-[220px] p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between relative select-none ${
                          isFlipped
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-md'
                            : 'bg-white text-neutral-900 border-neutral-200/90 hover:border-neutral-300 hover:shadow-xs'
                        }`}
                      >
                        {/* Top info */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isFlipped ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            Card {cIdx + 1}
                          </span>
                          <span
                            className={`text-[10px] flex items-center gap-1 font-medium ${
                              isFlipped ? 'text-neutral-400' : 'text-neutral-500'
                            }`}
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>{isFlipped ? 'Click for Term' : 'Click to Reveal'}</span>
                          </span>
                        </div>

                        {/* Card Body */}
                        <div className="py-4">
                          {!isFlipped ? (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-orange-600 tracking-wider block mb-1">
                                Concept / Term
                              </span>
                              <h4 className="text-base sm:text-lg font-extrabold leading-snug">
                                {card.front}
                              </h4>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">
                                Plain English Definition
                              </span>
                              <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
                                {card.back}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Bottom Footer & Mastery */}
                        <div
                          className="pt-3 border-t flex items-center justify-between gap-2 border-neutral-100/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            {card.requirement_ids?.map((rid) => (
                              <span
                                key={rid}
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                  isFlipped
                                    ? 'bg-neutral-800 text-neutral-300'
                                    : 'bg-neutral-100 text-neutral-600'
                                }`}
                              >
                                {rid}
                              </span>
                            ))}
                          </div>

                          {/* Mastery Selection */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCardMastery((prev) => ({ ...prev, [card.id]: 1 }))}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                                mastery === 1
                                  ? 'bg-rose-500 text-white'
                                  : isFlipped
                                  ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                                  : 'bg-neutral-100 text-neutral-500 hover:text-neutral-900'
                              }`}
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => setCardMastery((prev) => ({ ...prev, [card.id]: 2 }))}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                                mastery === 2
                                  ? 'bg-amber-500 text-white'
                                  : isFlipped
                                  ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                                  : 'bg-neutral-100 text-neutral-500 hover:text-neutral-900'
                              }`}
                            >
                              Learning
                            </button>
                            <button
                              type="button"
                              onClick={() => setCardMastery((prev) => ({ ...prev, [card.id]: 3 }))}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
                                mastery === 3
                                  ? 'bg-emerald-500 text-white'
                                  : isFlipped
                                  ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                                  : 'bg-neutral-100 text-neutral-500 hover:text-neutral-900'
                              }`}
                            >
                              Mastered
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Study Schedule */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs">
            <div className="mb-6 pb-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-orange-500" />
                  <span>Preparation Study Timeline ({daysAvailable} Days)</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Deterministic day-by-day plan tailored to your available days before the interview.
                </p>
              </div>
            </div>

            {scheduleDays.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No schedule days configured.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduleDays.map((day) => {
                  const dayMinutes = day.minutes || (day as any).allocated_minutes || 60;
                  const dayQuestionIds = day.question_ids || [];

                  return (
                    <div key={day.day} className="p-5 rounded-2xl border border-neutral-200/90 bg-neutral-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-neutral-900 text-white">
                          Day {day.day}
                        </span>
                        <span className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{dayMinutes} Mins</span>
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-neutral-900">{day.focus || 'Core Preparation'}</h4>
                        <div className="mt-2.5">
                          <span className="text-[10px] uppercase font-semibold text-neutral-400 block mb-1">
                            Questions Scheduled:
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {dayQuestionIds.map((qId) => (
                              <span
                                key={qId}
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-neutral-700 font-semibold"
                              >
                                {qId}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Company Brief & Role Specs */}
        {activeTab === 'brief' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Research */}
            <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
                <Building2 className="w-4 h-4 text-orange-500" />
                <h3 className="text-base font-bold text-neutral-900">Company Intelligence</h3>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Company Name</h4>
                <p className="text-sm font-bold text-neutral-900 mt-0.5">{targetCompany}</p>
              </div>

              {companyBrief?.summary && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Summary</h4>
                  <p className="text-xs text-neutral-700 mt-1 leading-relaxed">{companyBrief.summary}</p>
                </div>
              )}

              {companyBrief?.what_they_do && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">What They Do</h4>
                  <p className="text-xs text-neutral-700 mt-1 leading-relaxed">{companyBrief.what_they_do}</p>
                </div>
              )}

              {companyBrief?.sources && companyBrief.sources.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Sources</h4>
                  <ul className="space-y-1">
                    {companyBrief.sources.map((src: string, sIdx: number) => (
                      <li key={sIdx} className="text-[11px] text-neutral-500 truncate">
                        • {src}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Extracted Role Requirements */}
            <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
                <Briefcase className="w-4 h-4 text-orange-500" />
                <h3 className="text-base font-bold text-neutral-900">Extracted Job Requirements ({requirements.length})</h3>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {requirements.map((req) => (
                  <div key={req.id} className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-orange-600 uppercase">{req.id}</span>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          req.priority === 'must'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {req.priority}
                      </span>
                    </div>
                    <p className="text-neutral-800">{req.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generation Modal */}
      <GenerateKitModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};
