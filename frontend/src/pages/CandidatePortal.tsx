import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Plus, Building2, Calendar, CheckCircle2, ChevronRight,
  BookOpen, Trash2, ArrowRight, Layers, Award, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { KitRecord } from '../types';
import { GenerateKitModal } from '../components/GenerateKitModal';

const PRESET_TEMPLATES = [
  {
    company: 'Stripe',
    role: 'Senior Frontend Engineer',
    days: 7,
    focus: 'React, TypeScript, CSS Flexbox, Checkout Performance',
    jd: `Role: Senior Frontend Engineer\nCompany: Stripe\nResponsibilities:\n- Build high-performance, accessible checkout experiences using React, TypeScript, and Tailwind.\n- Collaborate with designers and backend API engineers to ensure low-latency payment workflows.\n- Maintain test coverage, design systems, and frontend state management.\nRequirements:\n- 4+ years of professional experience with modern React, TypeScript, and state management.\n- Deep expertise in DOM manipulation, web performance optimization, and CSS Flexbox / Grid.\n- Strong understanding of RESTful / GraphQL APIs and asynchronous patterns.`,
  },
  {
    company: 'Google',
    role: 'Software Engineer III',
    days: 10,
    focus: 'Distributed Systems, System Design, REST APIs, Scalability',
    jd: `Role: Software Engineer III\nCompany: Google\nResponsibilities:\n- Design scalable backend microservices and public-facing developer APIs.\n- Optimize throughput, database queries, and system reliability across global clusters.\n- Write clean, maintainable, high-efficiency code in TypeScript or Go.\nRequirements:\n- 3+ years experience designing backend services and distributed architectures.\n- Deep familiarity with relational/NoSQL databases and caching strategies.\n- Strong algorithmic problem solving and concurrency fundamentals.`,
  },
  {
    company: 'Airbnb',
    role: 'Product Engineer',
    days: 5,
    focus: 'Design Systems, Component Architecture, Accessibility',
    jd: `Role: Product Engineer\nCompany: Airbnb\nResponsibilities:\n- Craft intuitive, pixel-perfect user interfaces across Airbnb guest and host experiences.\n- Partner with product managers and researchers to iterate on high-conversion funnels.\n- Expand Airbnb's shared component library and design system.\nRequirements:\n- Strong experience with modern frontend frameworks and responsive UI design.\n- Passion for user experience, accessibility (a11y), and interaction design.\n- Excellent communication and cross-functional execution skills.`,
  },
];

export const CandidatePortal: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [kits, setKits] = useState<KitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKits = () => {
    setLoading(true);
    api.getUserKits()
      .then((res) => setKits(res || []))
      .catch((err) => console.error('Failed to load kits:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchKits();
  }, []);

  const handleDelete = async (e: React.MouseEvent, kitId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this interview kit?')) return;
    try {
      setDeletingId(kitId);
      await api.deleteKit(kitId);
      setKits((prev) => prev.filter((k) => (k._id || (k as any).id) !== kitId));
    } catch (err) {
      console.error('Failed to delete kit:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const candidateName = user?.email ? user.email.split('@')[0] : 'Candidate';

  // Compute metrics
  const totalQuestions = kits.reduce((acc, k) => acc + (k.data?.questions?.length || 0), 0);
  const uniqueCompanies = Array.from(
    new Set(kits.map((k) => k.company || k.data?.company_brief?.name || 'Company'))
  ).length;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#FCFAF6] pb-24 relative">
      {/* Top Ambient Warm Glow */}
      <div className="w-[520px] h-[520px] bg-gradient-to-br from-amber-200/40 via-orange-100/30 to-transparent rounded-full blur-3xl absolute -top-24 -left-24 -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-neutral-200/60">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100/80 border border-orange-300/60 text-orange-800 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Candidate Command Center</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Welcome back, <span className="capitalize">{candidateName}</span> 👋
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xl">
              Here is your interview prep vault. Select an active kit to jump into practice, or generate a new tailored kit for your target company.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="self-start sm:self-center px-6 py-3 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Kit</span>
          </button>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-8">
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium mb-1">
              <Layers className="w-4 h-4 text-orange-500" />
              <span>Active Prep Kits</span>
            </div>
            <p className="text-2xl font-extrabold text-neutral-900">{kits.length}</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium mb-1">
              <BookOpen className="w-4 h-4 text-orange-500" />
              <span>Prepared Questions</span>
            </div>
            <p className="text-2xl font-extrabold text-neutral-900">{totalQuestions}</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium mb-1">
              <Building2 className="w-4 h-4 text-orange-500" />
              <span>Companies Targeted</span>
            </div>
            <p className="text-2xl font-extrabold text-neutral-900">{uniqueCompanies}</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium mb-1">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Must-Have Coverage</span>
            </div>
            <p className="text-2xl font-extrabold text-emerald-600">100%</p>
          </div>
        </div>

        {/* Kits Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              <span>Your Interview Kits</span>
            </h2>
            <span className="text-xs text-neutral-400">{kits.length} Total</span>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-neutral-500">Loading your interview kits...</p>
            </div>
          ) : kits.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-3xl border border-neutral-200/80 p-8 sm:p-12 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center mx-auto mb-4 text-orange-600">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">No Interview Kits Generated Yet</h3>
              <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto mb-6 leading-relaxed">
                Tell us your target company and job description. We'll automatically generate a customized question bank, answer frameworks, and a daily study schedule.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span>Create My First Kit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Grid of Kits */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {kits.map((kit) => {
                const kitId = kit._id || (kit as any).id;
                const companyName = kit.company || kit.data?.company_brief?.name || 'Target Company';
                const rawRole = kit.data?.role?.title || kit.role || 'Target Role';
                const roleTitle = rawRole.replace(/^(role|job\s*title|position|title)\s*[:\-–—]\s*/i, '').trim() || 'Target Role';
                const questionsCount = kit.data?.questions?.length || 0;
                const days = kit.days_available || kit.data?.schedule?.length || 7;
                const seniority = kit.data?.role?.seniority || 'Mid-Senior';
                const initial = companyName.charAt(0).toUpperCase();

                return (
                  <div
                    key={kitId}
                    onClick={() => navigate(`/kits/${kitId}`)}
                    className="bg-white rounded-3xl border border-neutral-200/90 p-6 shadow-xs hover:shadow-md hover:border-orange-200 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      {/* Company Avatar & Delete Action */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white font-extrabold flex items-center justify-center text-sm shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider block">
                              {companyName}
                            </span>
                            <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{days} Days Available</span>
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDelete(e, kitId)}
                          disabled={deletingId === kitId}
                          title="Delete kit"
                          className="p-2 text-neutral-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Role Title */}
                      <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 group-hover:text-neutral-700 transition-colors leading-snug mb-3">
                        {roleTitle}
                      </h3>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-5">
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                          {questionsCount} Questions
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 capitalize">
                          {seniority}
                        </span>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>100% Covered</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Button */}
                    <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900 group-hover:text-orange-600 transition-colors flex items-center gap-1">
                        <span>Open Workspace</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                      <span className="text-[10px] text-neutral-400">Ready to Practice</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Role Presets for Testing & Evaluators */}
        <div className="bg-amber-50/50 rounded-3xl border border-amber-200/70 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span>Quick Test Templates</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Generate an interview kit instantly using a pre-configured company role.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRESET_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.company}
                onClick={() => setModalOpen(true)}
                className="bg-white rounded-2xl border border-neutral-200/80 p-4 hover:border-orange-300 hover:shadow-xs transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">
                    {tmpl.company}
                  </span>
                  <span className="text-[10px] text-neutral-400">{tmpl.days} Days</span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-orange-600 transition-colors">
                  {tmpl.role}
                </h4>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                  {tmpl.focus}
                </p>
                <div className="mt-3 text-[11px] font-semibold text-neutral-700 flex items-center gap-1">
                  <span>Use Template</span>
                  <ChevronRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global Kit Generation Modal */}
      <GenerateKitModal isOpen={modalOpen} onClose={() => { setModalOpen(false); fetchKits(); }} />
    </div>
  );
};
