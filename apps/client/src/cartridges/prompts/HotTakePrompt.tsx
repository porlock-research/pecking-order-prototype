import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PromptPhases, ActivityEvents, type SocialPlayer } from '@pecking-order/shared-types';
import { Flame } from 'lucide-react';
import { PersonaAvatar } from '../../components/PersonaAvatar';

interface HotTakeCartridge {
  promptType: 'HOT_TAKE';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  stances: Record<string, 'AGREE' | 'DISAGREE'>;
  results: {
    statement: string;
    agreeCount: number;
    disagreeCount: number;
    minorityStance: 'AGREE' | 'DISAGREE' | null;
    silverRewards: Record<string, number>;
  } | null;
}

interface HotTakePromptProps {
  cartridge: HotTakeCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function HotTakePrompt({ cartridge, playerId, roster, engine }: HotTakePromptProps) {
  const { promptText, phase, eligibleVoters, stances, results } = cartridge;
  const hasResponded = playerId in stances;
  const respondedCount = Object.keys(stances).length;
  const totalEligible = eligibleVoters.length;
  const reduce = useReducedMotion();

  const handleStance = (stance: 'AGREE' | 'DISAGREE') => {
    if (hasResponded || phase !== PromptPhases.ACTIVE) return;
    engine.sendActivityAction(ActivityEvents.HOTTAKE.RESPOND, { stance });
  };

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1] }}
      className="mx-4 my-2 rounded-xl bg-skin-glass border border-skin-base overflow-hidden shadow-card"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-skin-pink/[0.06] border-b border-skin-base flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display tracking-widest bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-0.5 text-skin-pink uppercase font-bold">
            Hot Take
          </span>
          <span className="text-xs font-display tracking-wide text-skin-dim tabular-nums">
            {respondedCount}/{totalEligible} responded
          </span>
        </div>
        {hasResponded && (
          <motion.span
            initial={reduce ? undefined : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-[10px] font-display tracking-widest text-skin-green uppercase font-bold"
          >
            Submitted
          </motion.span>
        )}
      </div>

      {/* Active Phase */}
      {phase === PromptPhases.ACTIVE && (
        <div className="p-5 space-y-5">
          {/* Prompt statement — hero surface */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-skin-pink/10 border border-skin-pink/25 flex items-center justify-center shrink-0 shadow-[0_0_14px_color-mix(in_oklch,var(--po-pink)_25%,transparent)]">
              <Flame size={18} strokeWidth={2.25} className="text-skin-pink" />
            </div>
            <p
              className="font-display text-skin-base leading-snug italic pt-1"
              style={{ fontSize: 'clamp(16px, 4vw, 19px)', letterSpacing: -0.2 }}
            >
              &ldquo;{promptText}&rdquo;
            </p>
          </div>

          {!hasResponded ? (
            <div className="grid grid-cols-2 gap-3">
              {/* AGREE — pre-colored green tint, not neutral white */}
              <motion.button
                onClick={() => handleStance('AGREE')}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                whileHover={reduce ? undefined : { y: -2 }}
                className="px-4 py-4 rounded-lg border bg-skin-green/[0.06] border-skin-green/30 text-skin-base hover:bg-skin-green/15 hover:border-skin-green/60 transition-colors text-sm font-bold text-center font-display uppercase tracking-wide"
              >
                Agree
              </motion.button>
              {/* DISAGREE — pre-colored pink tint */}
              <motion.button
                onClick={() => handleStance('DISAGREE')}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                whileHover={reduce ? undefined : { y: -2 }}
                className="px-4 py-4 rounded-lg border bg-skin-pink/[0.06] border-skin-pink/30 text-skin-base hover:bg-skin-pink/15 hover:border-skin-pink/60 transition-colors text-sm font-bold text-center font-display uppercase tracking-wide"
              >
                Disagree
              </motion.button>
            </div>
          ) : (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center py-3"
            >
              <p className="text-sm text-skin-dim">
                You voted{' '}
                <span
                  className={
                    stances[playerId] === 'AGREE'
                      ? 'font-bold text-skin-green font-display tracking-wide'
                      : 'font-bold text-skin-pink font-display tracking-wide'
                  }
                >
                  {stances[playerId]}
                </span>
              </p>
              <p className="text-xs text-skin-dim mt-1.5 font-display tracking-wider uppercase opacity-75">
                Waiting for others…
              </p>
            </motion.div>
          )}
        </div>
      )}

      {/* Results Phase */}
      {phase === PromptPhases.RESULTS && results && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="p-5 space-y-5"
        >
          {/* Prompt restated */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-skin-pink/10 border border-skin-pink/25 flex items-center justify-center shrink-0">
              <Flame size={18} strokeWidth={2.25} className="text-skin-pink" />
            </div>
            <p
              className="font-display text-skin-base leading-snug italic pt-1"
              style={{ fontSize: 'clamp(16px, 4vw, 19px)', letterSpacing: -0.2 }}
            >
              &ldquo;{results.statement || promptText}&rdquo;
            </p>
          </div>

          <p className="text-center text-sm font-bold text-skin-pink uppercase tracking-widest font-display">
            Results
          </p>

          <div className="space-y-2">
            {(() => {
              const total = results.agreeCount + results.disagreeCount;
              const pctAgree = total > 0 ? Math.round((results.agreeCount / total) * 100) : 50;
              const pctDisagree = 100 - pctAgree;
              const agreeIsMinority = results.minorityStance === 'AGREE';
              const disagreeIsMinority = results.minorityStance === 'DISAGREE';
              return (
                <>
                  <div className="flex justify-between text-xs font-display tracking-wide uppercase text-skin-dim tabular-nums">
                    <span>Agree ({results.agreeCount})</span>
                    <span>Disagree ({results.disagreeCount})</span>
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-9 border border-skin-base">
                    <motion.div
                      initial={reduce ? { width: `${pctAgree}%` } : { width: 0 }}
                      animate={{ width: `${pctAgree}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                      className={`flex items-center justify-center text-xs font-display font-bold tracking-wide ${
                        agreeIsMinority
                          ? 'bg-skin-gold/30 text-skin-gold'
                          : 'bg-skin-green/20 text-skin-green'
                      }`}
                    >
                      {pctAgree > 10 ? `${pctAgree}%` : ''}
                    </motion.div>
                    <motion.div
                      initial={reduce ? { width: `${pctDisagree}%` } : { width: 0 }}
                      animate={{ width: `${pctDisagree}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                      className={`flex items-center justify-center text-xs font-display font-bold tracking-wide ${
                        disagreeIsMinority
                          ? 'bg-skin-gold/30 text-skin-gold'
                          : 'bg-skin-pink/20 text-skin-pink'
                      }`}
                    >
                      {pctDisagree > 10 ? `${pctDisagree}%` : ''}
                    </motion.div>
                  </div>
                  {results.minorityStance && (
                    <p className="text-center text-xs font-display tracking-wider uppercase text-skin-gold font-bold">
                      Minority bonus: {results.minorityStance} (+10 silver)
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Individual stances — who said what */}
          <div className="space-y-1 pt-2">
            <p className="text-[10px] font-display tracking-[0.2em] uppercase text-skin-dim/60 text-center mb-2 font-bold">
              Who said what
            </p>
            {Object.keys(stances).length === 0 && (
              <p className="text-xs text-skin-dim/50 text-center py-2 italic">
                No responses
              </p>
            )}
            {Object.entries(stances).map(([pid, stance]) => {
              const player = roster[pid];
              const isMe = pid === playerId;
              return (
                <div
                  key={pid}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                    isMe ? 'bg-skin-gold/[0.08] border border-skin-gold/20' : ''
                  }`}
                >
                  <PersonaAvatar
                    avatarUrl={player?.avatarUrl}
                    personaName={player?.personaName}
                    size={22}
                  />
                  <span
                    className={`text-xs flex-1 ${
                      isMe ? 'font-bold text-skin-gold' : 'text-skin-dim'
                    }`}
                  >
                    {isMe ? 'You' : player?.personaName || pid}
                  </span>
                  <span
                    className={`text-xs font-display font-bold tracking-wide ${
                      stance === 'AGREE' ? 'text-skin-green' : 'text-skin-pink'
                    }`}
                  >
                    {stance}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Silver reward — hero moment */}
          {results.silverRewards[playerId] != null && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.9, 1.08, 1] }}
              transition={{ duration: 0.55, times: [0, 0.55, 1], delay: 0.4 }}
              className="text-center py-3"
            >
              <p className="text-[10px] font-display tracking-[0.24em] uppercase text-skin-dim mb-1.5 font-bold">
                You Earned
              </p>
              <p
                className="font-display font-bold text-skin-gold"
                style={{
                  fontSize: 'clamp(28px, 7vw, 36px)',
                  letterSpacing: -0.8,
                  textShadow: '0 0 24px color-mix(in oklch, var(--po-gold) 40%, transparent)',
                }}
              >
                +{results.silverRewards[playerId]} silver
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
