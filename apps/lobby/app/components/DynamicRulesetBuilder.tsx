'use client';

import { useState } from 'react';

// ── Types ──

export interface DynamicRulesetConfig {
  // Whitelists — which mechanics the Game Master can pick from
  allowedVoteTypes: string[];
  allowedGameTypes: string[];
  allowedActivityTypes: string[];
  // Social scaling
  social: {
    dmChars: { mode: 'FIXED' | 'DIMINISHING'; base: number; floor: number };
    dmPartners: { mode: 'FIXED' | 'DIMINISHING'; base: number; floor: number };
    dmCost: number;
    groupDmEnabled: boolean;
  };
  // Inactivity
  inactivity: {
    enabled: boolean;
    thresholdDays: number;
    action: 'ELIMINATE';
  };
  // Day count
  dayCount: {
    mode: 'ACTIVE_PLAYERS_MINUS_ONE' | 'FIXED';
    maxDays?: number;
    fixedCount?: number;
  };
  // Schedule preset
  schedulePreset: 'DEFAULT' | 'COMPACT' | 'SPEED_RUN';
  // Start time
  startTime: string;  // datetime-local format: "YYYY-MM-DDTHH:MM"
}

export function createDefaultDynamicConfig(): DynamicRulesetConfig {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  return {
    allowedVoteTypes: ['MAJORITY', 'EXECUTIONER', 'BUBBLE', 'SECOND_TO_LAST', 'PODIUM_SACRIFICE', 'SHIELD', 'TRUST_PAIRS'],
    allowedGameTypes: ['TRIVIA', 'GAP_RUN', 'GRID_PUSH', 'SEQUENCE', 'REACTION_TIME', 'COLOR_MATCH', 'STACKER', 'QUICK_MATH', 'SIMON_SAYS', 'AIM_TRAINER', 'BET_BET_BET', 'BLIND_AUCTION', 'KINGS_RANSOM', 'THE_SPLIT', 'TOUCH_SCREEN', 'REALTIME_TRIVIA'],
    allowedActivityTypes: ['PLAYER_PICK', 'PREDICTION', 'WOULD_YOU_RATHER', 'HOT_TAKE', 'CONFESSION', 'GUESS_WHO'],
    social: {
      dmChars: { mode: 'DIMINISHING', base: 1200, floor: 400 },
      dmPartners: { mode: 'DIMINISHING', base: 3, floor: 1 },
      dmCost: 1,
      groupDmEnabled: true,
    },
    inactivity: {
      enabled: true,
      thresholdDays: 2,
      action: 'ELIMINATE',
    },
    dayCount: {
      mode: 'ACTIVE_PLAYERS_MINUS_ONE',
    },
    schedulePreset: 'DEFAULT',
    startTime: `${dateStr}T09:00`,
  };
}

// ── Mechanic metadata ──

const VOTE_TYPES = [
  { value: 'MAJORITY', label: 'Majority', desc: 'Simple vote — most votes eliminated', min: 3 },
  { value: 'EXECUTIONER', label: 'Executioner', desc: 'Top 3 immune, rest vote', min: 5 },
  { value: 'BUBBLE', label: 'Bubble', desc: 'Top 3 immune, bottom at risk', min: 6 },
  { value: 'SECOND_TO_LAST', label: '2nd to Last', desc: 'Second-lowest votes eliminated', min: 3 },
  { value: 'PODIUM_SACRIFICE', label: 'Podium Sacrifice', desc: 'Top 3 pick one to sacrifice', min: 5 },
  { value: 'SHIELD', label: 'Shield', desc: 'Vote to save — unshielded eliminated', min: 4 },
  { value: 'TRUST_PAIRS', label: 'Trust Pairs', desc: 'Paired voting — betrayal costs', min: 5 },
];

const GAME_TYPES = [
  { value: 'TRIVIA', label: 'Trivia', cat: 'knowledge' },
  { value: 'REALTIME_TRIVIA', label: 'RT Trivia', cat: 'knowledge' },
  { value: 'GAP_RUN', label: 'Gap Run', cat: 'arcade' },
  { value: 'GRID_PUSH', label: 'Grid Push', cat: 'arcade' },
  { value: 'SEQUENCE', label: 'Sequence', cat: 'arcade' },
  { value: 'REACTION_TIME', label: 'Reaction', cat: 'arcade' },
  { value: 'COLOR_MATCH', label: 'Color Match', cat: 'arcade' },
  { value: 'STACKER', label: 'Stacker', cat: 'arcade' },
  { value: 'QUICK_MATH', label: 'Quick Math', cat: 'arcade' },
  { value: 'SIMON_SAYS', label: 'Simon Says', cat: 'arcade' },
  { value: 'AIM_TRAINER', label: 'Aim Trainer', cat: 'arcade' },
  { value: 'BET_BET_BET', label: 'Bet Bet Bet', cat: 'social' },
  { value: 'BLIND_AUCTION', label: 'Blind Auction', cat: 'social' },
  { value: 'KINGS_RANSOM', label: "King's Ransom", cat: 'social' },
  { value: 'THE_SPLIT', label: 'The Split', cat: 'social' },
  { value: 'TOUCH_SCREEN', label: 'Touch Screen', cat: 'social' },
];

const ACTIVITY_TYPES = [
  { value: 'PLAYER_PICK', label: 'Player Pick' },
  { value: 'PREDICTION', label: 'Prediction' },
  { value: 'WOULD_YOU_RATHER', label: 'Would You Rather' },
  { value: 'HOT_TAKE', label: 'Hot Take' },
  { value: 'CONFESSION', label: 'Confession' },
  { value: 'GUESS_WHO', label: 'Guess Who' },
];

const SCHEDULE_PRESETS = [
  { value: 'DEFAULT', label: 'Default', desc: 'Full-day pacing — events spread across hours' },
  { value: 'COMPACT', label: 'Compact', desc: 'Condensed schedule — tighter event windows' },
  { value: 'SPEED_RUN', label: 'Speed Run', desc: 'Minutes apart — same-day testing' },
] as const;

// ── Sub-components ──

function SectionHeader({ children, badge }: { children: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] font-bold text-skin-dim uppercase tracking-widest font-display">
        {children}
      </span>
      {badge && (
        <span className="text-[9px] font-mono text-skin-gold/70 bg-skin-gold/10 border border-skin-gold/20 rounded-full px-1.5 py-0.5">
          {badge}
        </span>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  size = 'sm',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
}) {
  const w = size === 'md' ? 'w-9 h-5' : 'w-6 h-3';
  const dot = size === 'md' ? 'w-4 h-4' : 'w-2 h-2';
  const translate = size === 'md' ? 'translate-x-4' : 'translate-x-3';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 ${w} items-center rounded-full border transition-all duration-200 ${
        checked
          ? 'bg-skin-gold/30 border-skin-gold/50'
          : 'bg-skin-input border-skin-base'
      }`}
    >
      <span
        className={`${dot} rounded-full transition-all duration-200 ${
          checked
            ? `${translate} bg-skin-gold`
            : 'translate-x-0.5 bg-skin-dim/40'
        }`}
      />
    </button>
  );
}

function ChipCheckbox({
  label,
  checked,
  onChange,
  sub,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`text-left px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-all duration-150 ${
        checked
          ? 'bg-skin-gold/10 border-skin-gold/40 text-skin-gold'
          : 'bg-skin-input/60 border-skin-base text-skin-dim/50 hover:border-skin-dim/30 hover:text-skin-dim/70'
      }`}
    >
      <span className="block font-bold leading-tight">{label}</span>
      {sub && <span className="block text-[8px] opacity-60 mt-0.5">{sub}</span>}
    </button>
  );
}

function NumberStepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] font-mono text-skin-dim/50">{label}</span>}
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-6 h-6 flex items-center justify-center bg-skin-input border border-skin-base rounded-md font-mono text-xs text-skin-dim hover:text-skin-gold hover:border-skin-gold/30 transition-all disabled:opacity-30 disabled:hover:text-skin-dim disabled:hover:border-skin-base"
      >
        -
      </button>
      <span className="font-mono text-sm text-skin-gold w-8 text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-6 h-6 flex items-center justify-center bg-skin-input border border-skin-base rounded-md font-mono text-xs text-skin-dim hover:text-skin-gold hover:border-skin-gold/30 transition-all disabled:opacity-30 disabled:hover:text-skin-dim disabled:hover:border-skin-base"
      >
        +
      </button>
    </div>
  );
}

// ── Collapsible section ──

function Section({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border border-skin-base rounded-lg bg-skin-input/40 overflow-hidden">
      <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none hover:bg-skin-input/60 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-skin-dim uppercase tracking-widest font-display">
            {title}
          </span>
          {badge && (
            <span className="text-[9px] font-mono text-skin-gold/70 bg-skin-gold/10 border border-skin-gold/20 rounded-full px-1.5 py-0.5">
              {badge}
            </span>
          )}
        </div>
        <svg
          className="w-3 h-3 text-skin-dim/40 transition-transform group-open:rotate-90"
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-skin-base/50">
        {children}
      </div>
    </details>
  );
}

// ── Main component ──

export function DynamicRulesetBuilder({
  config,
  onChange,
}: {
  config: DynamicRulesetConfig;
  onChange: (config: DynamicRulesetConfig) => void;
}) {
  function toggleWhitelist(field: 'allowedVoteTypes' | 'allowedGameTypes' | 'allowedActivityTypes', value: string) {
    const current = config[field];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    // Require at least one selection
    if (next.length === 0) return;
    onChange({ ...config, [field]: next });
  }

  function updateSocial(patch: Partial<DynamicRulesetConfig['social']>) {
    onChange({ ...config, social: { ...config.social, ...patch } });
  }

  function updateSocialDmChars(patch: Partial<DynamicRulesetConfig['social']['dmChars']>) {
    onChange({ ...config, social: { ...config.social, dmChars: { ...config.social.dmChars, ...patch } } });
  }

  function updateSocialDmPartners(patch: Partial<DynamicRulesetConfig['social']['dmPartners']>) {
    onChange({ ...config, social: { ...config.social, dmPartners: { ...config.social.dmPartners, ...patch } } });
  }

  function updateInactivity(patch: Partial<DynamicRulesetConfig['inactivity']>) {
    onChange({ ...config, inactivity: { ...config.inactivity, ...patch } });
  }

  function updateDayCount(patch: Partial<DynamicRulesetConfig['dayCount']>) {
    onChange({ ...config, dayCount: { ...config.dayCount, ...patch } });
  }

  const voteCount = config.allowedVoteTypes.length;
  const gameCount = config.allowedGameTypes.length;
  const activityCount = config.allowedActivityTypes.length;

  return (
    <div className="space-y-3">
      {/* ── Allowed Vote Types ── */}
      <Section title="Vote Types" badge={`${voteCount}/${VOTE_TYPES.length}`} defaultOpen>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {VOTE_TYPES.map(vt => (
            <ChipCheckbox
              key={vt.value}
              label={vt.label}
              sub={`${vt.min}+ players`}
              checked={config.allowedVoteTypes.includes(vt.value)}
              onChange={() => toggleWhitelist('allowedVoteTypes', vt.value)}
            />
          ))}
        </div>
        <p className="text-[8px] font-mono text-skin-dim/30 mt-2">
          FINALS is always used for the last day
        </p>
      </Section>

      {/* ── Allowed Game Types ── */}
      <Section title="Games" badge={`${gameCount}/${GAME_TYPES.length}`}>
        {(['arcade', 'knowledge', 'social'] as const).map(cat => (
          <div key={cat} className="mt-2 first:mt-1">
            <span className="text-[8px] font-mono text-skin-dim/40 uppercase tracking-wider">{cat}</span>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {GAME_TYPES.filter(g => g.cat === cat).map(gt => (
                <ChipCheckbox
                  key={gt.value}
                  label={gt.label}
                  checked={config.allowedGameTypes.includes(gt.value)}
                  onChange={() => toggleWhitelist('allowedGameTypes', gt.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ── Allowed Activity Types ── */}
      <Section title="Activities" badge={`${activityCount}/${ACTIVITY_TYPES.length}`}>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {ACTIVITY_TYPES.map(at => (
            <ChipCheckbox
              key={at.value}
              label={at.label}
              checked={config.allowedActivityTypes.includes(at.value)}
              onChange={() => toggleWhitelist('allowedActivityTypes', at.value)}
            />
          ))}
        </div>
      </Section>

      {/* ── Social Scaling ── */}
      <Section title="Social Rules">
        <div className="space-y-3 mt-1">
          {/* DM Characters */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-skin-dim/60">DM Characters</span>
              <select
                value={config.social.dmChars.mode}
                onChange={e => updateSocialDmChars({ mode: e.target.value as any })}
                className="appearance-none bg-skin-input text-skin-base border border-skin-base rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-skin-gold/50 transition-all"
              >
                <option value="FIXED">Fixed</option>
                <option value="DIMINISHING">Diminishing</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <NumberStepper label="Base" value={config.social.dmChars.base} onChange={v => updateSocialDmChars({ base: v })} min={100} max={5000} />
              {config.social.dmChars.mode === 'DIMINISHING' && (
                <NumberStepper label="Floor" value={config.social.dmChars.floor} onChange={v => updateSocialDmChars({ floor: v })} min={50} max={config.social.dmChars.base} />
              )}
            </div>
          </div>

          {/* DM Partners */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-skin-dim/60">DM Partners</span>
              <select
                value={config.social.dmPartners.mode}
                onChange={e => updateSocialDmPartners({ mode: e.target.value as any })}
                className="appearance-none bg-skin-input text-skin-base border border-skin-base rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-skin-gold/50 transition-all"
              >
                <option value="FIXED">Fixed</option>
                <option value="DIMINISHING">Diminishing</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <NumberStepper label="Base" value={config.social.dmPartners.base} onChange={v => updateSocialDmPartners({ base: v })} min={1} max={10} />
              {config.social.dmPartners.mode === 'DIMINISHING' && (
                <NumberStepper label="Floor" value={config.social.dmPartners.floor} onChange={v => updateSocialDmPartners({ floor: v })} min={1} max={config.social.dmPartners.base} />
              )}
            </div>
          </div>

          {/* DM Cost + Group DM */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <NumberStepper label="DM Cost" value={config.social.dmCost} onChange={v => updateSocial({ dmCost: v })} min={0} max={20} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-skin-dim/50">Group DMs</span>
              <Toggle checked={config.social.groupDmEnabled} onChange={v => updateSocial({ groupDmEnabled: v })} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Inactivity ── */}
      <Section title="Inactivity">
        <div className="space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-skin-dim/60">Auto-eliminate inactive players</span>
            <Toggle checked={config.inactivity.enabled} onChange={v => updateInactivity({ enabled: v })} size="md" />
          </div>
          {config.inactivity.enabled && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-skin-dim/50">Consecutive inactive days</span>
              <NumberStepper
                value={config.inactivity.thresholdDays}
                onChange={v => updateInactivity({ thresholdDays: v })}
                min={1}
                max={5}
              />
            </div>
          )}
        </div>
      </Section>

      {/* ── Day Count ── */}
      <Section title="Day Count">
        <div className="space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-skin-dim/60">Mode</span>
            <select
              value={config.dayCount.mode}
              onChange={e => {
                const mode = e.target.value as DynamicRulesetConfig['dayCount']['mode'];
                updateDayCount({
                  mode,
                  fixedCount: mode === 'FIXED' ? (config.dayCount.fixedCount ?? 5) : undefined,
                  maxDays: mode === 'ACTIVE_PLAYERS_MINUS_ONE' ? config.dayCount.maxDays : undefined,
                });
              }}
              className="appearance-none bg-skin-input text-skin-base border border-skin-base rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-skin-gold/50 transition-all"
            >
              <option value="ACTIVE_PLAYERS_MINUS_ONE">Players - 1</option>
              <option value="FIXED">Fixed</option>
            </select>
          </div>
          {config.dayCount.mode === 'ACTIVE_PLAYERS_MINUS_ONE' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-skin-dim/50">Max days cap</span>
              <NumberStepper
                value={config.dayCount.maxDays ?? 7}
                onChange={v => updateDayCount({ maxDays: v })}
                min={2}
                max={14}
              />
            </div>
          )}
          {config.dayCount.mode === 'FIXED' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-skin-dim/50">Fixed day count</span>
              <NumberStepper
                value={config.dayCount.fixedCount ?? 5}
                onChange={v => updateDayCount({ fixedCount: v })}
                min={1}
                max={14}
              />
            </div>
          )}
        </div>
      </Section>

      {/* ── Start Time ── */}
      <Section title="Start Time" defaultOpen>
        <div className="space-y-2 mt-1">
          <div className="flex items-center gap-3">
            <input
              type="datetime-local"
              value={config.startTime}
              onChange={e => onChange({ ...config, startTime: e.target.value })}
              className="flex-1 bg-skin-input text-skin-base border border-skin-base rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-skin-gold/50 transition-all"
            />
          </div>
          {config.schedulePreset === 'SPEED_RUN' && (
            <button
              type="button"
              onClick={() => {
                const soon = new Date(Date.now() + 2 * 60_000);
                const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000)
                  .toISOString().slice(0, 16);
                onChange({ ...config, startTime: local });
              }}
              className="text-[10px] font-mono text-skin-gold/70 hover:text-skin-gold border border-skin-gold/20 rounded-lg px-2 py-1 transition-all"
            >
              Set to now + 2 min
            </button>
          )}
          <p className="text-[8px] font-mono text-skin-dim/30">
            {config.schedulePreset === 'SPEED_RUN'
              ? 'Game starts at this time — events fire minutes apart'
              : 'Day 1 begins on this date — events follow the preset schedule'}
          </p>
        </div>
      </Section>

      {/* ── Schedule Preset ── */}
      <Section title="Schedule" defaultOpen>
        <div className="space-y-1.5 mt-1">
          {SCHEDULE_PRESETS.map(sp => (
            <label
              key={sp.value}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                config.schedulePreset === sp.value
                  ? 'bg-skin-gold/10 border-skin-gold/40'
                  : 'bg-skin-input/40 border-skin-base hover:border-skin-dim/30'
              }`}
            >
              <input
                type="radio"
                name="schedulePreset"
                value={sp.value}
                checked={config.schedulePreset === sp.value}
                onChange={() => onChange({ ...config, schedulePreset: sp.value })}
                className="sr-only"
              />
              <div
                className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                  config.schedulePreset === sp.value
                    ? 'border-skin-gold'
                    : 'border-skin-dim/30'
                }`}
              >
                {config.schedulePreset === sp.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-skin-gold" />
                )}
              </div>
              <div>
                <span className={`text-[10px] font-mono font-bold ${
                  config.schedulePreset === sp.value ? 'text-skin-gold' : 'text-skin-dim/60'
                }`}>
                  {sp.label}
                </span>
                <span className="block text-[8px] font-mono text-skin-dim/30">{sp.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}
