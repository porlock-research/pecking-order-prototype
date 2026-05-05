'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { QuestionWithOptions, QaSubmission } from './questions-pool';

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

interface QuestionStepProps {
  questions: QuestionWithOptions[];
  personaName: string;
  onComplete: (submissions: QaSubmission[]) => void;
  onSkip: () => void;
}

export function QuestionStep({ questions, personaName, onComplete, onSkip }: QuestionStepProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submissions, setSubmissions] = useState<Record<string, QaSubmission>>({});
  const [customText, setCustomText] = useState('');
  const [direction, setDirection] = useState(0);

  const question = questions[currentIndex];
  const currentSub = question ? submissions[question.id] : undefined;
  const totalAnswered = Object.keys(submissions).length;

  function selectAnswer(index: number, custom?: string) {
    if (!question) return;
    const sub: QaSubmission = {
      questionId: question.id,
      selectedIndex: index,
      ...(index === 3 && custom ? { customAnswer: custom } : {}),
    };
    setSubmissions(prev => ({ ...prev, [question.id]: sub }));
    setCustomText('');

    // Auto-advance after short delay
    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        setDirection(1);
        setCurrentIndex(i => i + 1);
      }, 300);
    }
  }

  function goTo(index: number) {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    setCustomText('');
  }

  function handleComplete() {
    const allSubs = questions.map(q =>
      submissions[q.id] ?? { questionId: q.id, selectedIndex: 0 }
    );
    onComplete(allSubs);
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const allAnswered = totalAnswered === questions.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header. Skip is its own button row instead of an inline link
          buried in the paragraph — /harden onboarding rule: "make
          onboarding optional, let experienced users skip" needs a
          visible escape hatch, not a 12px underline. The context line
          ("one goes public…") sets the stakes — these answers matter,
          here's exactly how. Without it the Q&A reads as setup busywork. */}
      <div className="text-center flex-shrink-0 space-y-1.5">
        <h2 className="text-base font-display font-black text-skin-pink uppercase tracking-widest">
          Get Into Character
        </h2>
        <p className="text-xs text-skin-dim">
          Answer as <span className="text-skin-pink font-bold">{personaName}</span>
        </p>
        <p className="text-[11px] text-skin-base/70 leading-snug max-w-xs mx-auto">
          One answer goes public when you arrive. The other two stay sealed until Day 1.
        </p>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-[11px] font-display font-black text-skin-base/85 hover:text-skin-pink uppercase tracking-[0.16em] underline decoration-skin-pink decoration-2 underline-offset-4 transition-colors"
        >
          Skip — use defaults
        </button>
      </div>

      {/* Progress dots. User flagged the answered (/55 red) and unanswered
          (bg-skin-input) states as "not viewable" against the grid bg.
          Pumped: answered = full red (no opacity drop), unanswered =
          bg-skin-base/[0.18] solid 18% paper lift + /40 border (matches
          wizard pip treatment). Active still gets the wider pill + halo. */}
      <div className="flex justify-center gap-2 py-3 flex-shrink-0">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => goTo(i)}
            aria-label={`Go to question ${i + 1}`}
            className={`rounded-full transition-all duration-200 ${
              i === currentIndex
                ? 'bg-skin-pink w-6 h-3 shadow-[0_0_10px_color-mix(in_oklch,var(--po-pink)_50%,transparent)]'
                : submissions[q.id]
                  ? 'bg-skin-pink w-3 h-3'
                  : 'bg-skin-base/[0.18] w-3 h-3 border border-skin-base/40'
            }`}
          />
        ))}
      </div>

      {/* Question card */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {question && (
            <motion.div
              key={question.id}
              custom={direction}
              initial={{ x: direction > 0 ? '80%' : '-80%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? '-80%' : '80%', opacity: 0 }}
              transition={SPRING}
              className="h-full flex flex-col gap-3"
            >
              {/* Question text — display-font kicker ("Q 1 / 3") in red
                  reads as a tabloid quiz prompt. Stem stays body font for
                  legibility (display fonts at body sizes are unreadable);
                  bumped from text-lg/font-bold to text-xl/font-black for
                  the bolder pass. */}
              <div className="text-center px-2 space-y-1.5">
                <span className="inline-block px-2.5 py-0.5 bg-skin-pink/15 border border-skin-pink/40 rounded-md text-[11px] font-display font-black text-skin-pink uppercase tracking-[0.18em] tabular-nums">
                  Q {currentIndex + 1} / {questions.length}
                </span>
                <h2 className="text-xl font-body font-black text-skin-base leading-tight tracking-tight">
                  {question.text}
                </h2>
              </div>

              {/* Answer buttons. Letter chip is now a pill that anchors
                  each option visually — A/B/C are scannable column-style
                  even on mobile. Selected state: full pink fill with white
                  text on the chip too (was outline-only with translucent
                  fill, which read as ghosted). Unselected uses bg-skin-input
                  for a real ~#1d1d1d surface (was bg-skin-panel/30, a
                  transparent wash that disappeared on the deep page bg). */}
              <div className="space-y-2.5 px-1">
                {question.options.map((option, idx) => {
                  const isSelected = currentSub?.selectedIndex === idx;
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => selectAnswer(idx)}
                      whileTap={{ scale: 0.98 }}
                      className={`group w-full text-left rounded-xl text-sm font-body transition-all duration-200 flex items-stretch overflow-hidden border-2 ${
                        isSelected
                          ? 'bg-skin-pink border-skin-pink text-skin-base shadow-[0_0_24px_color-mix(in_oklch,var(--po-pink)_30%,transparent)]'
                          : 'bg-skin-input border-skin-base/15 text-skin-base hover:border-skin-pink/50 hover:bg-skin-input/80'
                      }`}
                    >
                      {/* Letter chip — column on the left, full-height,
                          tabloid-bold. Solid red on selected, paper-tone
                          rim on unselected. */}
                      <span
                        aria-hidden
                        className={`flex-shrink-0 w-10 flex items-center justify-center font-display font-black text-base ${
                          isSelected
                            ? 'bg-skin-pink-depth text-skin-base'
                            : 'bg-skin-deep text-skin-pink border-r border-skin-base/15'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 px-3 py-3 leading-snug font-medium">
                        {option}
                      </span>
                    </motion.button>
                  );
                })}

                {/* "Other" write-in option — same chip + body grammar as
                    the lettered options for visual consistency. The input
                    sits inside the body cell; selected state matches. */}
                <div className={`rounded-xl transition-all duration-200 flex items-stretch overflow-hidden border-2 ${
                  currentSub?.selectedIndex === 3
                    ? 'bg-skin-pink border-skin-pink shadow-[0_0_24px_color-mix(in_oklch,var(--po-pink)_30%,transparent)]'
                    : 'bg-skin-input border-skin-base/15'
                }`}>
                  <span
                    aria-hidden
                    className={`flex-shrink-0 w-10 flex items-center justify-center font-display font-black text-base ${
                      currentSub?.selectedIndex === 3
                        ? 'bg-skin-pink-depth text-skin-base'
                        : 'bg-skin-deep text-skin-pink border-r border-skin-base/15'
                    }`}
                  >
                    D
                  </span>
                  <div className="flex-1 flex items-center gap-2 px-3 py-2">
                    <input
                      type="text"
                      value={currentSub?.selectedIndex === 3 ? (currentSub.customAnswer ?? '') : customText}
                      onChange={(e) => setCustomText(e.target.value.slice(0, 140))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customText.trim()) {
                          selectAnswer(3, customText.trim());
                        }
                      }}
                      onFocus={() => {
                        if (currentSub?.selectedIndex !== 3 && customText.trim()) {
                          selectAnswer(3, customText.trim());
                        }
                      }}
                      placeholder="Write your own…"
                      aria-label="Custom answer"
                      className={`flex-1 bg-transparent text-sm focus:outline-none ${
                        currentSub?.selectedIndex === 3
                          ? 'text-skin-base placeholder:text-skin-base/60'
                          : 'text-skin-base placeholder:text-skin-base/40'
                      }`}
                      maxLength={140}
                    />
                    {customText.trim() && currentSub?.selectedIndex !== 3 && (
                      <button
                        onClick={() => selectAnswer(3, customText.trim())}
                        className="text-xs font-display font-black text-skin-pink uppercase tracking-widest hover:underline"
                      >
                        Pick
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Done button — appears on last question once at least one answer exists */}
      {isLastQuestion && totalAnswered > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 pt-2 space-y-1"
        >
          <p className="text-center text-xs text-skin-dim">
            {allAnswered ? 'All done!' : `${totalAnswered}/${questions.length} answered — unanswered use defaults`}
          </p>
          <button
            onClick={handleComplete}
            className="w-full py-3 bg-skin-pink text-skin-base font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg hover:brightness-110 active:scale-[0.99] transition-all"
          >
            Continue
          </button>
        </motion.div>
      )}
    </div>
  );
}
