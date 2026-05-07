'use client';

import { useState } from 'react';
import { GAME_TYPE_INFO, ACTIVITY_TYPE_INFO, VOTE_TYPE_INFO, type GameCategory } from '@pecking-order/shared-types';

// ── Types ──

export interface DynamicRulesetConfig {
  // Whitelists — which mechanics the Game Master can pick from
  allowedVoteTypes: string[];
  allowedGameTypes: string[];
  allowedActivityTypes: string[];
  allowedDilemmaTypes: string[];
  // Social
  social: {
    dmCharsPerPlayer: number;       // chars per active player (total = this × alive)
    dmPartners: number;             // total DM slots (1-on-1 + group DMs combined)
    dmCost: number;
    requireDmInvite: boolean;       // require mutual invite before DM
    dmSlotsPerPlayer: number;       // max DM conversations per player per day (when invite mode on)
    disableNudgeThrottle: boolean;  // remove the per-(sender,target,day) nudge rate limit
  };
  // Inactivity
  inactivity: {
    enabled: boolean;
    thresholdDays: number;
    action: 'ELIMINATE';
  };
  // Confession Booth (Spec C) — opt-in per game
  confessions: {
    enabled: boolean;
  };
  // Day count
  dayCount: {
    maxDays: number;
  };
  // Schedule preset
  schedulePreset: 'DEFAULT' | 'COMPACT' | 'PLAYTEST' | 'PLAYTEST_SHORT' | 'PLAYTEST_NEXT' | 'SPEED_RUN';
  // Start time
  startTime: string;  // datetime-local format: "YYYY-MM-DDTHH:MM"
  // Min players to start
  minPlayers: number;
}

export function createDefaultDynamicConfig(): DynamicRulesetConfig {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  return {
    // Defaults: all selectable types ON. Hosts can opt out per-game via the chip toggles.
    allowedVoteTypes: VOTE_TYPES.map(v => v.value),
    allowedGameTypes: GAME_TYPES.map(g => g.value),
    allowedActivityTypes: ACTIVITY_TYPES.map(a => a.value),
    allowedDilemmaTypes: ['SILVER_GAMBIT', 'SPOTLIGHT', 'GIFT_OR_GRIEF'],
    social: {
      dmCharsPerPlayer: 300,
      dmPartners: 3,
      dmCost: 1,
      requireDmInvite: false,
      dmSlotsPerPlayer: 5,
      disableNudgeThrottle: false,
    },
    inactivity: {
      enabled: true,
      thresholdDays: 2,
      action: 'ELIMINATE',
    },
    confessions: {
      enabled: false,
    },
    dayCount: {
      maxDays: 7,
    },
    schedulePreset: 'DEFAULT',
    startTime: `${dateStr}T09:00`,
    minPlayers: 3,
  };
}

// ── Mechanic metadata (derived from canonical shared-types *_INFO objects) ──
//
// Adding a new vote/game/activity to its registry + *_INFO entry surfaces
// the chip here automatically. Hand-maintaining these lists historically
// caused drift — see git history for the arcade-batch missing-from-lobby bug.

const VOTE_TYPES: { value: string; label: string; min: number }[] = Object.entries(VOTE_TYPE_INFO)
  .filter(([, info]) => info.selectableInLobby)
  .map(([value, info]) => ({ value, label: info.name, min: info.minPlayers }));

const GAME_TYPES: { value: string; label: string; cat: GameCategory }[] = Object.entries(GAME_TYPE_INFO)
  .map(([value, info]) => ({ value, label: info.name, cat: info.category }));

const ACTIVITY_TYPES: { value: string; label: string }[] = Object.entries(ACTIVITY_TYPE_INFO)
  .map(([value, info]) => ({ value, label: info.name }));

// ── Schedule preset data ──

interface PresetTimelineEvent {
  action: string;
  label: string;
  time: string;          // "HH:MM" for calendar, "+Xm" for offset
  condition?: 'hasGame' | 'hasActivity';
}

const SCHEDULE_PRESETS: {
  value: 'DEFAULT' | 'COMPACT' | 'PLAYTEST' | 'PLAYTEST_SHORT' | 'PLAYTEST_NEXT' | 'SPEED_RUN';
  label: string;
  desc: string;
  dayLength: string;
  events: PresetTimelineEvent[];
}[] = [
  {
    value: 'DEFAULT',
    label: 'Default',
    desc: 'Full-day pacing — events spread 9am to midnight',
    dayLength: '~15 hours',
    events: [
      { action: 'OPEN_GROUP_CHAT', label: 'Group Chat', time: '09:00' },
      { action: 'OPEN_DMS', label: 'DMs Open', time: '10:00' },
      { action: 'CLOSE_GROUP_CHAT', label: 'Group Chat Closes', time: '10:00' },
      { action: 'START_GAME', label: 'Game Starts', time: '10:00', condition: 'hasGame' },
      { action: 'END_GAME', label: 'Game Ends', time: '12:00', condition: 'hasGame' },
      { action: 'START_ACTIVITY', label: 'Activity Starts', time: '14:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY', label: 'Activity Ends', time: '16:00', condition: 'hasActivity' },
      { action: 'OPEN_VOTING', label: 'Voting Opens', time: '20:00' },
      { action: 'CLOSE_VOTING', label: 'Voting Closes', time: '23:00' },
      { action: 'CLOSE_DMS', label: 'DMs Close', time: '23:00' },
      { action: 'END_DAY', label: 'Day Ends', time: '23:59' },
    ],
  },
  {
    value: 'COMPACT',
    label: 'Compact',
    desc: 'Compressed — events 9am to 5:30pm',
    dayLength: '~8.5 hours',
    events: [
      { action: 'OPEN_GROUP_CHAT', label: 'Group Chat', time: '09:00' },
      { action: 'OPEN_DMS', label: 'DMs Open', time: '09:30' },
      { action: 'START_GAME', label: 'Game Starts', time: '09:30', condition: 'hasGame' },
      { action: 'CLOSE_GROUP_CHAT', label: 'Group Chat Closes', time: '10:30' },
      { action: 'END_GAME', label: 'Game Ends', time: '11:30', condition: 'hasGame' },
      { action: 'START_ACTIVITY', label: 'Activity Starts', time: '12:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY', label: 'Activity Ends', time: '13:00', condition: 'hasActivity' },
      { action: 'OPEN_VOTING', label: 'Voting Opens', time: '14:00' },
      { action: 'CLOSE_VOTING', label: 'Voting Closes', time: '17:00' },
      { action: 'CLOSE_DMS', label: 'DMs Close', time: '17:00' },
      { action: 'END_DAY', label: 'Day Ends', time: '17:30' },
    ],
  },
  {
    value: 'PLAYTEST',
    label: 'Playtest',
    desc: 'Compressed day — events 10am to 5pm',
    dayLength: '~7 hours',
    events: [
      { action: 'OPEN_GROUP_CHAT', label: 'Group Chat', time: '10:00' },
      { action: 'OPEN_DMS', label: 'DMs Open', time: '11:00' },
      { action: 'CLOSE_GROUP_CHAT', label: 'Group Chat Closes', time: '12:00' },
      { action: 'START_GAME', label: 'Game Starts', time: '12:01', condition: 'hasGame' },
      { action: 'START_ACTIVITY', label: 'Activity Starts', time: '12:02', condition: 'hasActivity' },
      { action: 'END_GAME', label: 'Game Ends', time: '14:00', condition: 'hasGame' },
      { action: 'END_ACTIVITY', label: 'Activity Ends', time: '15:00', condition: 'hasActivity' },
      { action: 'OPEN_GROUP_CHAT', label: 'Group Chat Re-opens', time: '15:01' },
      { action: 'OPEN_VOTING', label: 'Voting Opens', time: '15:02' },
      { action: 'CLOSE_DMS', label: 'DMs Close', time: '16:00' },
      { action: 'CLOSE_GROUP_CHAT', label: 'Group Chat Closes', time: '16:01' },
      { action: 'CLOSE_VOTING', label: 'Voting Closes', time: '16:59' },
      { action: 'END_DAY', label: 'Day Ends', time: '17:00' },
    ],
  },
  {
    value: 'PLAYTEST_SHORT',
    label: 'Playtest Short',
    desc: 'Afternoon sprint — events 3pm to 8pm',
    dayLength: '~5 hours',
    events: [
      { action: 'OPEN_GROUP_CHAT', label: 'Group Chat', time: '15:00' },
      { action: 'OPEN_DMS', label: 'DMs Open', time: '16:00' },
      { action: 'CLOSE_GROUP_CHAT', label: 'Group Chat Closes', time: '18:00' },
      { action: 'START_GAME', label: 'Game Starts', time: '18:01', condition: 'hasGame' },
      { action: 'END_GAME', label: 'Game Ends', time: '19:00', condition: 'hasGame' },
      { action: 'CLOSE_DMS', label: 'DMs Close', time: '19:01' },
      { action: 'OPEN_VOTING', label: 'Voting Opens', time: '19:02' },
      { action: 'CLOSE_VOTING', label: 'Voting Closes', time: '20:00' },
      { action: 'END_DAY', label: 'Day Ends', time: '20:01' },
    ],
  },
  {
    value: 'PLAYTEST_NEXT',
    label: 'Playtest Next',
    desc: 'Full day, dense beats — 10am to 8pm. Elim 30min before close',
    dayLength: '~10 hours',
    events: [
      { action: 'OPEN_GROUP_CHAT',       label: 'Group Chat',          time: '10:00' },
      { action: 'START_DILEMMA',         label: 'Dilemma Starts',      time: '10:01' },
      { action: 'OPEN_DMS',              label: 'DMs Open',            time: '11:00' },
      { action: 'START_GAME',            label: 'Game Starts',         time: '12:00', condition: 'hasGame' },
      { action: 'END_GAME',              label: 'Game Ends',           time: '13:30', condition: 'hasGame' },
      { action: 'CLOSE_DMS',             label: 'DMs Close',           time: '13:31' },
      { action: 'START_ACTIVITY',        label: 'Activity Starts',     time: '14:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY',          label: 'Activity Ends',       time: '15:30', condition: 'hasActivity' },
      { action: 'OPEN_DMS',              label: 'DMs Re-open',         time: '15:31' },
      { action: 'END_DILEMMA',           label: 'Dilemma Ends',        time: '16:30' },
      { action: 'OPEN_VOTING',           label: 'Voting Opens',        time: '17:00' },
      { action: 'CLOSE_DMS',             label: 'DMs Close',           time: '17:01' },
      { action: 'CLOSE_VOTING',          label: 'Voting Closes',       time: '19:30' },
      { action: 'ELIMINATE',             label: 'Elimination',         time: '19:32' },
      { action: 'START_CONFESSION_CHAT', label: 'Confession Booth',    time: '19:33' },
      { action: 'END_CONFESSION_CHAT',   label: 'Confession Closes',   time: '19:57' },
      { action: 'END_DAY',               label: 'Day Ends',            time: '20:00' },
    ],
  },
  {
    value: 'SPEED_RUN',
    label: 'Speed Run',
    desc: 'Minutes apart — for testing',
    dayLength: '~23 min',
    events: [
      { action: 'OPEN_GROUP_CHAT', label: 'Group Chat', time: '+0m' },
      { action: 'OPEN_DMS', label: 'DMs Open', time: '+2m' },
      { action: 'CLOSE_GROUP_CHAT', label: 'Group Chat Closes', time: '+2m' },
      { action: 'START_GAME', label: 'Game Starts', time: '+3m', condition: 'hasGame' },
      { action: 'END_GAME', label: 'Game Ends', time: '+8m', condition: 'hasGame' },
      { action: 'START_ACTIVITY', label: 'Activity Starts', time: '+10m', condition: 'hasActivity' },
      { action: 'END_ACTIVITY', label: 'Activity Ends', time: '+15m', condition: 'hasActivity' },
      { action: 'OPEN_VOTING', label: 'Voting Opens', time: '+17m' },
      { action: 'CLOSE_VOTING', label: 'Voting Closes', time: '+20m' },
      { action: 'CLOSE_DMS', label: 'DMs Close', time: '+20m' },
      { action: 'END_DAY', label: 'Day Ends', time: '+23m' },
    ],
  },
];

// ── Sub-components ──

function Toggle({
  checked,
  onChange,
  size = 'sm',
  'data-testid': testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}) {
  const w = size === 'md' ? 'w-9 h-5' : 'w-6 h-3';
  const dot = size === 'md' ? 'w-4 h-4' : 'w-2 h-2';
  const translate = size === 'md' ? 'translate-x-4' : 'translate-x-3';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 ${w} items-center rounded-full border transition-all duration-200 ${
        checked
          ? 'bg-[rgba(247,197,46,0.3)] border-[rgba(247,197,46,0.5)]'
          : 'bg-skin-input border-skin-base'
      }`}
    >
      <span
        className={`${dot} rounded-full transition-all duration-200 ${
          checked
            ? `${translate} bg-skin-gold`
            : 'translate-x-0.5 bg-[rgba(168,163,156,0.4)]'
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
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  sub?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`text-left px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-all duration-150 ${
        checked
          ? 'bg-[rgba(247,197,46,0.1)] border-[rgba(247,197,46,0.4)] text-skin-gold'
          : 'bg-[rgba(29,29,29,0.6)] border-skin-base text-[rgba(168,163,156,0.5)] hover:border-[rgba(168,163,156,0.3)] hover:text-[rgba(168,163,156,0.7)]'
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
  step = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] font-mono text-[rgba(168,163,156,0.5)]">{label}</span>}
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="w-6 h-6 flex items-center justify-center bg-skin-input border border-skin-base rounded-md font-mono text-xs text-skin-dim hover:text-skin-gold hover:border-[rgba(247,197,46,0.3)] transition-all disabled:opacity-30 disabled:hover:text-skin-dim disabled:hover:border-skin-base"
      >
        -
      </button>
      <span className="font-mono text-sm text-skin-gold w-8 text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="w-6 h-6 flex items-center justify-center bg-skin-input border border-skin-base rounded-md font-mono text-xs text-skin-dim hover:text-skin-gold hover:border-[rgba(247,197,46,0.3)] transition-all disabled:opacity-30 disabled:hover:text-skin-dim disabled:hover:border-skin-base"
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
  testId,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <details data-testid={testId} open={defaultOpen} className="group border border-skin-base rounded-lg bg-[rgba(29,29,29,0.4)] overflow-hidden">
      <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none hover:bg-[rgba(29,29,29,0.6)] transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-skin-dim uppercase tracking-widest font-display">
            {title}
          </span>
          {badge && (
            <span className="text-[9px] font-mono text-[rgba(247,197,46,0.7)] bg-[rgba(247,197,46,0.1)] border border-[rgba(247,197,46,0.2)] rounded-full px-1.5 py-0.5">
              {badge}
            </span>
          )}
        </div>
        <svg
          className="w-3 h-3 text-[rgba(168,163,156,0.4)] transition-transform group-open:rotate-90"
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-[rgba(245,243,240,0.5)]">
        {children}
      </div>
    </details>
  );
}

// ── Timeline preview ──

function TimelinePreview({
  preset,
  hasGames,
  hasActivities,
}: {
  preset: typeof SCHEDULE_PRESETS[number];
  hasGames: boolean;
  hasActivities: boolean;
}) {
  const filteredEvents = preset.events.filter(e => {
    if (e.condition === 'hasGame' && !hasGames) return false;
    if (e.condition === 'hasActivity' && !hasActivities) return false;
    return true;
  });

  return (
    <div className="mt-2 border border-[rgba(245,243,240,0.4)] rounded-lg bg-[rgba(29,29,29,0.2)] p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] font-mono text-[rgba(168,163,156,0.4)] uppercase tracking-wider">Day 1 preview</span>
        <span className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">{preset.dayLength}</span>
      </div>
      <div className="space-y-0.5">
        {filteredEvents.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-[rgba(247,197,46,0.5)] w-10 text-right shrink-0">{e.time}</span>
            <div className="w-1 h-1 rounded-full bg-[rgba(247,197,46,0.3)] shrink-0" />
            <span className={`text-[9px] font-mono ${
              e.condition ? 'text-[rgba(168,163,156,0.3)] italic' : 'text-[rgba(168,163,156,0.5)]'
            }`}>
              {e.label}
              {e.condition && !((e.condition === 'hasGame' && hasGames) || (e.condition === 'hasActivity' && hasActivities))
                ? '' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
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

  function updateInactivity(patch: Partial<DynamicRulesetConfig['inactivity']>) {
    onChange({ ...config, inactivity: { ...config.inactivity, ...patch } });
  }

  const voteCount = config.allowedVoteTypes.length;
  const gameCount = config.allowedGameTypes.length;
  const activityCount = config.allowedActivityTypes.length;
  const hasGames = gameCount > 0;
  const hasActivities = activityCount > 0;
  const selectedPreset = SCHEDULE_PRESETS.find(p => p.value === config.schedulePreset) ?? SCHEDULE_PRESETS[0];

  return (
    <div className="space-y-3">
      {/* ── Allowed Vote Types ── */}
      <Section title="Vote Types" badge={`${voteCount}/${VOTE_TYPES.length}`} defaultOpen testId="section-vote-types">
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {VOTE_TYPES.map(vt => (
            <ChipCheckbox
              key={vt.value}
              label={vt.label}
              sub={`${vt.min}+ players`}
              checked={config.allowedVoteTypes.includes(vt.value)}
              onChange={() => toggleWhitelist('allowedVoteTypes', vt.value)}
              testId={`chip-${vt.value}`}
            />
          ))}
        </div>
        <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)] mt-2">
          FINALS is always used for the last day
        </p>
      </Section>

      {/* ── Allowed Game Types ── */}
      <Section title="Games" badge={gameCount > 0 ? `${gameCount}/${GAME_TYPES.length}` : 'none'} testId="section-games">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-mono text-[rgba(168,163,156,0.4)]">Deselect all to disable games</span>
          <button
            type="button"
            onClick={() => onChange({ ...config, allowedGameTypes: config.allowedGameTypes.length === GAME_TYPES.length ? [] : GAME_TYPES.map(g => g.value) })}
            className="text-[9px] font-mono text-[rgba(247,197,46,0.5)] hover:text-skin-gold transition-colors"
          >
            {config.allowedGameTypes.length === GAME_TYPES.length ? 'Clear all' : 'Select all'}
          </button>
        </div>
        {(['arcade', 'knowledge', 'social'] as const).map(cat => (
          <div key={cat} className="mt-2 first:mt-1">
            <span className="text-[8px] font-mono text-[rgba(168,163,156,0.4)] uppercase tracking-wider">{cat}</span>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {GAME_TYPES.filter(g => g.cat === cat).map(gt => (
                <ChipCheckbox
                  key={gt.value}
                  label={gt.label}
                  checked={config.allowedGameTypes.includes(gt.value)}
                  onChange={() => {
                    const current = config.allowedGameTypes;
                    const next = current.includes(gt.value)
                      ? current.filter(v => v !== gt.value)
                      : [...current, gt.value];
                    onChange({ ...config, allowedGameTypes: next });
                  }}
                  testId={`chip-${gt.value}`}
                />
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ── Allowed Activity Types ── */}
      <Section title="Activities" badge={activityCount > 0 ? `${activityCount}/${ACTIVITY_TYPES.length}` : 'none'} testId="section-activities">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-mono text-[rgba(168,163,156,0.4)]">Deselect all to disable activities</span>
          <button
            type="button"
            onClick={() => onChange({ ...config, allowedActivityTypes: config.allowedActivityTypes.length === ACTIVITY_TYPES.length ? [] : ACTIVITY_TYPES.map(a => a.value) })}
            className="text-[9px] font-mono text-[rgba(247,197,46,0.5)] hover:text-skin-gold transition-colors"
          >
            {config.allowedActivityTypes.length === ACTIVITY_TYPES.length ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {ACTIVITY_TYPES.map(at => (
            <ChipCheckbox
              key={at.value}
              label={at.label}
              checked={config.allowedActivityTypes.includes(at.value)}
              onChange={() => {
                const current = config.allowedActivityTypes;
                const next = current.includes(at.value)
                  ? current.filter(v => v !== at.value)
                  : [...current, at.value];
                onChange({ ...config, allowedActivityTypes: next });
              }}
              testId={`chip-${at.value}`}
            />
          ))}
        </div>
      </Section>

      {/* ── Social Rules ── */}
      <Section title="Social Rules" testId="section-social">
        <div className="space-y-3 mt-1">
          {/* DM Characters per player */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[rgba(168,163,156,0.6)]">DM Characters</span>
              <NumberStepper
                value={config.social.dmCharsPerPlayer}
                onChange={v => updateSocial({ dmCharsPerPlayer: v })}
                min={50}
                max={2000}
                step={50}
              />
            </div>
            <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
              {config.social.dmCharsPerPlayer} chars x active players = total DM budget per day
            </p>
          </div>

          {/* DM Partners */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[rgba(168,163,156,0.6)]">DM Slots</span>
              <NumberStepper
                value={config.social.dmPartners}
                onChange={v => updateSocial({ dmPartners: v })}
                min={1}
                max={10}
              />
            </div>
            <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
              Total DM conversations per day (1-on-1 + group DMs combined)
            </p>
          </div>

          {/* DM Cost */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[rgba(168,163,156,0.6)]">Silver per DM</span>
            <NumberStepper
              value={config.social.dmCost}
              onChange={v => updateSocial({ dmCost: v })}
              min={0}
              max={20}
            />
          </div>

          {/* Nudge Throttle */}
          <div className="space-y-2 pt-1 border-t border-[rgba(245,243,240,0.3)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[rgba(168,163,156,0.6)]">Allow repeat nudges (no throttle)</span>
              <Toggle checked={config.social.disableNudgeThrottle} onChange={v => updateSocial({ disableNudgeThrottle: v })} size="md" data-testid="disable-nudge-throttle-toggle" />
            </div>
            <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
              By default each sender can nudge each target only once per day. Toggle on to remove the limit.
            </p>
          </div>

          {/* DM Invite Mode */}
          <div className="space-y-2 pt-1 border-t border-[rgba(245,243,240,0.3)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[rgba(168,163,156,0.6)]">Require DM invitations</span>
              <Toggle checked={config.social.requireDmInvite} onChange={v => updateSocial({ requireDmInvite: v })} size="md" data-testid="dm-invite-toggle" />
            </div>
            <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
              Players must send and accept mutual invites before DM conversations open
            </p>
            {config.social.requireDmInvite && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[rgba(168,163,156,0.5)]">Conversations per player per day</span>
                  <NumberStepper
                    value={config.social.dmSlotsPerPlayer}
                    onChange={v => updateSocial({ dmSlotsPerPlayer: v })}
                    min={2}
                    max={10}
                  />
                </div>
                <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
                  Each player can have up to {config.social.dmSlotsPerPlayer} active DM conversations per day
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── Inactivity ── */}
      <Section title="Inactivity" testId="section-inactivity">
        <div className="space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[rgba(168,163,156,0.6)]">Auto-eliminate inactive players</span>
            <Toggle checked={config.inactivity.enabled} onChange={v => updateInactivity({ enabled: v })} size="md" />
          </div>
          {config.inactivity.enabled && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[rgba(168,163,156,0.5)]">Consecutive inactive days</span>
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

      {/* ── Confession Booth ── */}
      <Section title="Confession Booth" testId="section-confessions">
        <div className="space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[rgba(168,163,156,0.6)]">Enable confession phases</span>
            <Toggle
              checked={config.confessions.enabled}
              onChange={v => onChange({ ...config, confessions: { enabled: v } })}
              size="md"
              data-testid="confessions-enabled"
            />
          </div>
          <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
            Admins schedule <span className="text-[rgba(247,197,46,0.7)]">START_CONFESSION_CHAT</span> /
            <span className="text-[rgba(247,197,46,0.7)]"> END_CONFESSION_CHAT</span> timeline events to open
            an anonymous post window. Players drop confessions under a daily
            &ldquo;Confessor #N&rdquo; handle — everyone sees the tape, no one sees the name.
          </p>
        </div>
      </Section>

      {/* ── Day Count ── */}
      <Section title="Day Count" testId="section-day-count">
        <div className="space-y-2 mt-1">
          <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
            Days = active players - 1 (capped at max)
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[rgba(168,163,156,0.5)]">Max days</span>
            <NumberStepper
              value={config.dayCount.maxDays}
              onChange={v => onChange({ ...config, dayCount: { maxDays: v } })}
              min={2}
              max={14}
            />
          </div>
        </div>
      </Section>

      {/* ── Schedule Preset ── */}
      <Section title="Schedule" defaultOpen testId="section-schedule">
        <div className="space-y-1.5 mt-1">
          {SCHEDULE_PRESETS.map(sp => (
            <label
              key={sp.value}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                config.schedulePreset === sp.value
                  ? 'bg-[rgba(247,197,46,0.1)] border-[rgba(247,197,46,0.4)]'
                  : 'bg-[rgba(29,29,29,0.4)] border-skin-base hover:border-[rgba(168,163,156,0.3)]'
              }`}
            >
              <input
                type="radio"
                name="schedulePreset"
                value={sp.value}
                checked={config.schedulePreset === sp.value}
                onChange={() => onChange({ ...config, schedulePreset: sp.value })}
                className="sr-only"
                data-testid={`preset-${sp.value}`}
              />
              <div
                className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                  config.schedulePreset === sp.value
                    ? 'border-skin-gold'
                    : 'border-[rgba(168,163,156,0.3)]'
                }`}
              >
                {config.schedulePreset === sp.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-skin-gold" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold ${
                    config.schedulePreset === sp.value ? 'text-skin-gold' : 'text-[rgba(168,163,156,0.6)]'
                  }`}>
                    {sp.label}
                  </span>
                  <span className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">{sp.dayLength}</span>
                </div>
                <span className="block text-[8px] font-mono text-[rgba(168,163,156,0.3)]">{sp.desc}</span>
              </div>
            </label>
          ))}
        </div>
        <TimelinePreview preset={selectedPreset} hasGames={hasGames} hasActivities={hasActivities} />
      </Section>

      {/* ── Start Time ── */}
      <Section title="Start Time" defaultOpen testId="section-start-time">
        <div className="space-y-2 mt-1">
          <div className="flex items-center gap-3">
            <input
              type="datetime-local"
              data-testid="start-time-input"
              value={config.startTime}
              onChange={e => onChange({ ...config, startTime: e.target.value })}
              className="flex-1 bg-skin-input text-skin-base border border-skin-base rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[rgba(247,197,46,0.5)] transition-all"
            />
          </div>
          {config.schedulePreset === 'SPEED_RUN' && (
            <button
              type="button"
              data-testid="start-time-now-btn"
              onClick={() => {
                const soon = new Date(Date.now() + 5 * 60_000);
                const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000)
                  .toISOString().slice(0, 16);
                onChange({ ...config, startTime: local });
              }}
              className="text-[10px] font-mono text-[rgba(247,197,46,0.7)] hover:text-skin-gold border border-[rgba(247,197,46,0.2)] rounded-lg px-2 py-1 transition-all"
            >
              Set to now + 5 min
            </button>
          )}
          <p className="text-[8px] font-mono text-[rgba(168,163,156,0.3)]">
            {config.schedulePreset === 'SPEED_RUN'
              ? 'Game starts at this time — events fire minutes apart'
              : 'Day 1 begins on this date — events follow the preset schedule'}
          </p>
        </div>
      </Section>
    </div>
  );
}
