import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Building2, Calendar, FileText, ArrowRight, Upload, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface GenerateKitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_COMPANIES = ['Stripe', 'Google', 'Amazon', 'Meta', 'Airbnb', 'Netflix'];

const SAMPLE_JD = `Role: Senior Frontend Engineer
Company: Stripe
Responsibilities:
- Build high-performance, accessible checkout experiences using React, TypeScript, and Tailwind.
- Collaborate with designers and backend API engineers to ensure low-latency payment workflows.
- Maintain test coverage, design systems, and frontend state management.

Requirements:
- 4+ years of professional experience with modern React, TypeScript, and state management.
- Deep expertise in DOM manipulation, web performance optimization, and CSS Flexbox / Grid.
- Strong understanding of RESTful / GraphQL APIs and asynchronous patterns.
- Excellent communication and cross-functional leadership skills.`;

export const GenerateKitModal: React.FC<GenerateKitModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [days, setDays] = useState(7);
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(10);

  if (!isOpen) return null;

  const handleSelectCompany = (comp: string) => {
    setCompanyName(comp);
    if (!companyUrl) {
      setCompanyUrl(`https://${comp.toLowerCase().replace(/\s+/g, '')}.com`);
    }
  };

  const handleLoadSample = () => {
    setCompanyName('Stripe');
    setCompanyUrl('https://stripe.com');
    setDays(7);
    setJd(SAMPLE_JD);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setJd(content);
    };
    reader.readAsText(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      navigate('/login');
      return;
    }

    if (!jd.trim()) {
      setError('Please provide a Job Description text or upload a file.');
      return;
    }

    const finalCompany = companyName.trim() || 'Target Company';
    const finalUrl = companyUrl.trim() || `https://${finalCompany.toLowerCase().replace(/\s+/g, '')}.com`;

    try {
      setLoading(true);
      setProgressPercent(10);
      setProgressMsg('🕷️ Crawling company website & discovering hiring pages...');

      const { jobId } = await api.generateKit({
        jd,
        company_url: finalUrl,
        days: Number(days) || 7,
        company_name: finalCompany,
      });

      // Poll until complete
      const pollInterval = setInterval(async () => {
        try {
          const job = await api.getJobStatus(jobId);
          if (job.status === 'completed' && job.kitId) {
            clearInterval(pollInterval);
            setProgressPercent(100);
            setLoading(false);
            onClose();
            navigate(`/kits/${job.kitId}`);
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setLoading(false);
            setError(job.error || 'Kit generation encountered an error.');
          } else {
            setProgressPercent(job.percent || 40);
            setProgressMsg(job.progressMessage || 'Synthesizing tailored questions & schedule...');
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          setLoading(false);
          setError(pollErr.message || 'Error tracking generation progress');
        }
      }, 1500);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to start kit generation.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-neutral-200/90 shadow-2xl p-6 sm:p-8 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/70 text-orange-600 text-xs font-semibold mb-2.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Targeted Prep Kit</span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Who are you interviewing with?
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Specify the target company and job details so your questions and guides are 100% role-specific.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleGenerate} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Company Name & URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-orange-500" />
                Target Company Name
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-[11px] font-medium text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
              >
                Use Sample (Stripe Frontend)
              </button>
            </div>

            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Stripe, Google, Airbnb, Datadog..."
              className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            />

            {/* Quick company pills */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] text-neutral-400 mr-1">Popular:</span>
              {SAMPLE_COMPANIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelectCompany(c)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                    companyName.toLowerCase() === c.toLowerCase()
                      ? 'bg-orange-500 text-white border-orange-500 font-medium'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Company URL & Days Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Company Website (Optional)
              </label>
              <input
                type="url"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://company.com"
                className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-800 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  Days to Prepare:
                </span>
                <span className="text-orange-600 font-bold">{days} Days</span>
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>

          {/* Job Description Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-orange-500" />
                Job Description (JD)
              </label>
              <label className="text-[11px] font-medium text-neutral-600 hover:text-orange-600 cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Upload .txt file</span>
                <input
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              required
              rows={5}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the requirements, responsibilities, or entire job listing here..."
              className="w-full text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors resize-none leading-relaxed"
            />
          </div>


          {/* Progress Banner & Stage Bar during generation */}
          {loading && (
            <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin shrink-0" />
                  <p className="text-xs font-semibold text-orange-950">Generating Your Tailored Prep Kit</p>
                </div>
                <span className="text-xs font-bold text-orange-600">{progressPercent}%</span>
              </div>
              <p className="text-[11px] text-orange-800 font-medium pl-6">{progressMsg}</p>
              <div className="w-full bg-orange-200/70 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-orange-500 h-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-full transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <span>Create Interview Kit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
