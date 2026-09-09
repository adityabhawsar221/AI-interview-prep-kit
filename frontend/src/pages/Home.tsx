import React, { useState } from 'react';
import { Sparkles, ArrowRight, ExternalLink, Code2, CheckCircle2, ChevronDown, ChevronRight, BookOpen, Layers } from 'lucide-react';
import { GenerateKitModal } from '../components/GenerateKitModal';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface MockQuestion {
  id: string;
  question: string;
  category: string;
  guideTitle: string;
  guideDescription: string;
  concepts: string[];
  codeSample: string;
}

const MOCK_QUESTIONS: MockQuestion[] = [
  {
    id: 'q1',
    question: 'How does CSS Flexbox handle alignment, wrapping, and space distribution?',
    category: 'CSS & Layout',
    guideTitle: 'CSS Flexbox: Core Architecture & Alignment',
    guideDescription:
      'CSS Flexbox is a one-dimensional layout model designed to distribute space dynamically and align items seamlessly within a container, even when sizes are unknown.',
    concepts: [
      'Flex Container: The parent element (display: flex). Governs the main-axis and cross-axis alignment.',
      'justify-content: Controls distribution along the main axis (space-between, center, flex-start).',
      'align-items: Dictates cross-axis behavior across all direct child flex items.',
      'flex-shrink & flex-grow: Proportional factors determining how items adapt to viewport changes.',
    ],
    codeSample: `.container {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 1.5rem;\n  flex-wrap: wrap;\n}`,
  },
  {
    id: 'q2',
    question: 'What is JSX and how does React transform it under the hood?',
    category: 'React Architecture',
    guideTitle: 'JSX Compilation & Virtual DOM Mechanics',
    guideDescription:
      'JSX is a syntax extension for JavaScript that looks similar to HTML. Babel or SWC transpiles JSX into React.createElement() function calls which return lightweight JavaScript objects.',
    concepts: [
      'Syntactic Sugar: Transpiled into React.createElement(type, props, ...children).',
      'Virtual DOM Representation: Elements are plain JS objects describing what should appear on screen.',
      'Reconciliation: React diffs the Virtual DOM tree and applies minimal mutations to the real DOM.',
    ],
    codeSample: `// JSX:\nconst element = <h1 className="title">Hello World</h1>;\n\n// Transpiled to:\nconst element = React.createElement('h1', { className: 'title' }, 'Hello World');`,
  },
  {
    id: 'q3',
    question: 'Explain the JavaScript Event Loop, microtasks, and macrotasks.',
    category: 'JavaScript Core',
    guideTitle: 'Async Concurrency & The Event Loop',
    guideDescription:
      'JavaScript is single-threaded with a non-blocking I/O event loop. Asynchronous callbacks are coordinated through the Call Stack, Microtask Queue (Promises), and Macrotask Queue (setTimeout).',
    concepts: [
      'Call Stack: Executes synchronous frames in LIFO order.',
      'Microtask Queue: Higher priority. Processed immediately after the current frame (Promise.then, queueMicrotask).',
      'Macrotask Queue: Lower priority. (setTimeout, setInterval, DOM events).',
    ],
    codeSample: `console.log('1'); // Call Stack\nsetTimeout(() => console.log('2'), 0); // Macrotask\nPromise.resolve().then(() => console.log('3')); // Microtask\nconsole.log('4'); // Call Stack\n// Output order: 1 -> 4 -> 3 -> 2`,
  },
];

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<MockQuestion>(MOCK_QUESTIONS[0]);

  const handleStart = () => {
    navigate('/login');
  };

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] overflow-hidden">
      {/* Top Left Warm Ambient Glow */}
      <div className="w-[580px] h-[580px] bg-gradient-to-br from-amber-200/50 via-orange-100/40 to-transparent rounded-full blur-3xl absolute -top-32 -left-32 -z-10 pointer-events-none" />
      <div className="w-[400px] h-[400px] bg-gradient-to-br from-orange-100/30 via-amber-50/20 to-transparent rounded-full blur-2xl absolute top-96 -right-24 -z-10 pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-20">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Hero Content */}
          <div className="lg:col-span-7">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-100/70 border border-orange-300/60 text-orange-800 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>AI Powered</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-neutral-900 tracking-tight leading-[1.12]">
              Ace Interviews with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600">
                AI-Powered
              </span>{' '}
              Learning
            </h1>
          </div>

          {/* Right Hero Subtitle & CTA */}
          <div className="lg:col-span-5 flex flex-col justify-between pt-2">
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
              Get role-specific questions, expand answers when you need them, dive deeper into concepts,
              and organize everything your way. From preparation to mastery — your ultimate interview toolkit is here.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleStart}
                className="px-7 py-3 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-sm transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('preview-mockup');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-5 py-3 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 text-sm font-medium transition-colors cursor-pointer"
              >
                See Live Preview
              </button>
            </div>
          </div>
        </div>

        {/* Browser Window Mockup */}
        <div id="preview-mockup" className="mt-14 sm:mt-20">
          <div className="rounded-2xl sm:rounded-3xl border border-amber-200/80 bg-amber-50/50 p-2 sm:p-3.5 shadow-2xl backdrop-blur-sm">
            {/* Window Chrome Bar */}
            <div className="flex items-center justify-between px-3 py-2 text-xs text-neutral-500">
              {/* Window Dots & Navigation */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="hidden sm:flex items-center gap-1 text-neutral-400 pl-2 text-xs font-mono">
                  <span>&lt;</span>
                  <span>&gt;</span>
                </div>
              </div>

              {/* URL Bar */}
              <div className="w-full max-w-sm mx-auto px-4 py-1 rounded-full bg-white/90 border border-amber-200/60 text-center text-[11px] text-neutral-600 font-mono truncate shadow-2xs">
                https://ai-interview-preparation-kit.com/workspace
              </div>

              {/* Window Controls Right */}
              <div className="flex items-center gap-2 text-neutral-400">
                <ExternalLink className="w-3.5 h-3.5 hidden sm:block" />
              </div>
            </div>

            {/* App Canvas Inside Browser Window */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-200/80 p-5 sm:p-8 shadow-xs">
              {/* Canvas Header */}
              <div className="flex items-center justify-between pb-6 border-b border-neutral-100">
                <span className="font-bold text-base tracking-tight text-neutral-900">
                  AI Interview Preparation Kit
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-bold flex items-center justify-center text-xs">
                    M
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="font-semibold text-neutral-800 leading-tight">Candidate View</p>
                    <p className="text-[10px] text-neutral-400">Target: Stripe</p>
                  </div>
                </div>
              </div>

              {/* Role Header Banner */}
              <div className="pt-6 pb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                      Frontend Developer
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                      React.js, DOM manipulation, CSS Flexbox
                    </p>
                  </div>

                  <button
                    onClick={handleStart}
                    className="px-4 py-2 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-full border border-orange-200/80 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Generate Your Role</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Metadata Pills */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="text-xs px-3 py-1 rounded-full bg-neutral-900 text-white font-medium">
                    Experience: 2 Years
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-neutral-900 text-white font-medium">
                    10 Q&amp;A
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-neutral-900 text-white font-medium">
                    Target: Stripe
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-semibold">
                    7 Days Timeline
                  </span>
                </div>
              </div>

              {/* Dual-Pane Workspace Section */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Interview Q & A List */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-orange-500" />
                      <span>Interview Q &amp; A</span>
                    </h3>
                    <span className="text-xs text-neutral-400">Click a question to view Deep Dive</span>
                  </div>

                  <div className="space-y-2.5">
                    {MOCK_QUESTIONS.map((q, idx) => {
                      const isSelected = activeQuestion.id === q.id;
                      return (
                        <div
                          key={q.id}
                          onClick={() => setActiveQuestion(q)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-orange-50/60 border-orange-300 shadow-xs'
                              : 'bg-white border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                                  isSelected
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-neutral-100 text-neutral-700'
                                }`}
                              >
                                Q{idx + 1}
                              </span>
                              <div>
                                <p className="text-xs sm:text-sm font-semibold text-neutral-900 leading-snug">
                                  {q.question}
                                </p>
                                <span className="text-[11px] text-neutral-500 mt-1 inline-block">
                                  Category: {q.category}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-colors ${
                                isSelected
                                  ? 'bg-orange-500 text-white shadow-2xs'
                                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Learn More</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Concept Deep Dive & Guide */}
                <div className="lg:col-span-6 bg-neutral-50/70 border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200/80">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                        Concept Deep-Dive
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-neutral-400">
                      Live Reference
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                      {activeQuestion.guideTitle}
                    </h4>
                    <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                      {activeQuestion.guideDescription}
                    </p>
                  </div>

                  {/* Basic Concepts Section */}
                  <div>
                    <h5 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-2">
                      Basic Concepts:
                    </h5>
                    <ul className="space-y-1.5">
                      {activeQuestion.concepts.map((concept, cIdx) => (
                        <li key={cIdx} className="text-xs text-neutral-700 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{concept}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Code Sample */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500 mb-1.5">
                      <Code2 className="w-3.5 h-3.5 text-orange-500" />
                      <span>Code Blueprint</span>
                    </div>
                    <pre className="p-3.5 rounded-xl bg-neutral-900 text-neutral-100 text-xs font-mono overflow-x-auto leading-relaxed">
                      {activeQuestion.codeSample}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generation Modal */}
      <GenerateKitModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};
