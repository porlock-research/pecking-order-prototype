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
      {/* Header */}
      <div className="text-center flex-shrink-0 space-y-1">
        <h2 className="text-base font-display font-black text-skin-gold text-glow uppercase tracking-widest">
          Get Into Character
        </h2>
        <p className="text-xs text-skin-dim">
          Answer as <span className="text-skin-gold font-bold">{personaName}</span> — or{' '}
          <button
            onClick={onSkip}
            className="text-skin-gold/70 underline underline-offset-2 hover:text-skin-gold transition-colors"
          >
            skip to use defaults
          </button>
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 py-3 flex-shrink-0">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              i === currentIndex
                ? 'bg-skin-gold scale-125'
                : submissions[q.id]
                  ? 'bg-skin-gold/50'
                  : 'bg-skin-input'
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
              {/* Question text */}
              <div className="text-center px-2">
                <span className="text-xs font-display font-bold text-skin-dim tracking-widest tabular-nums">
                  {currentIndex + 1} / {questions.length}
                </span>
                {/* Question stem in body font (Manrope) — was font-display
                    (Big Shoulders Display, a condensed signage face). Display
                    fonts at body sizes are textbook readability complaints. */}
                <h2 className="text-lg font-body font-bold text-skin-base mt-1 leading-snug">
                  {question.text}
                </h2>
              </div>

              {/* Answer buttons */}
              <div className="space-y-2 px-1">
                {question.options.map((option, idx) => {
                  const isSelected = currentSub?.selectedIndex === idx;
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => selectAnswer(idx)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-body transition-all duration-200 ${
                        isSelected
                          ? 'bg-skin-gold/20 border-2 border-skin-gold text-skin-gold font-bold'
                          : 'bg-skin-panel/30 border border-skin-base/30 text-skin-base hover:bg-skin-panel/50'
                      }`}
                    >
                      {/* Option letter in body font; was display-condensed at
                          12px which made A/B/C/D unscannable. Bumped to text-sm
                          and text-skin-base/70 for legibility. */}
                      <span className="text-skin-base/70 font-body font-bold text-sm mr-2">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      {option}
                    </motion.button>
                  );
                })}

                {/* "Other" write-in option */}
                <div className={`rounded-xl transition-all duration-200 ${
                  currentSub?.selectedIndex === 3
                    ? 'bg-skin-gold/20 border-2 border-skin-gold'
                    : 'bg-skin-panel/30 border border-skin-base/30'
                }`}>
                  <div className="flex items-center gap-2 px-4 py-2">
                    <span className="text-skin-base/70 font-body font-bold text-sm">D.</span>
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
                      placeholder="Write your own..."
                      aria-label="Custom answer"
                      className="flex-1 bg-transparent text-sm text-skin-base placeholder:text-skin-dim/70 focus:outline-none"
                      maxLength={140}
                    />
                    {customText.trim() && currentSub?.selectedIndex !== 3 && (
                      <button
                        onClick={() => selectAnswer(3, customText.trim())}
                        className="text-xs font-display font-bold text-skin-gold uppercase"
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
            className="w-full py-3 bg-skin-gold text-skin-deep font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg hover:brightness-110 active:scale-[0.99] transition-all"
          >
            Continue
          </button>
        </motion.div>
      )}
    </div>
  );
}
