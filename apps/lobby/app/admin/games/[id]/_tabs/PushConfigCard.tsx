'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_PUSH_CONFIG, type PushTrigger } from '@pecking-order/shared-types';

interface Props {
  state: any;
  onCommand: (cmd: any) => Promise<void>;
}

interface Group {
  label: string;
  description: string;
  triggers: PushTrigger[];
}

// Triggers organized by what they signal. Mirrors PushTriggerSchema's comment
// blocks in shared-types/src/index.ts so admins can reason about scope.
const GROUPS: Group[] = [
  {
    label: 'Player → Player (targeted)',
    description: 'Direct interactions. Off = silence interpersonal pings.',
    triggers: ['DM_SENT', 'MENTION', 'REPLY', 'WHISPER', 'NUDGE', 'SILVER_RECEIVED'],
  },
  {
    label: 'Game-defining moments (broadcast)',
    description: 'Climactic events. Usually keep ON.',
    triggers: ['ELIMINATION', 'WINNER_DECLARED', 'GROUP_CHAT_MSG'],
  },
  {
    label: 'Phase transitions',
    description: 'Day-cycle anchors. Off = quieter daily rhythm.',
    triggers: ['DAY_START', 'ACTIVITY', 'VOTING', 'NIGHT_SUMMARY', 'DAILY_GAME'],
  },
  {
    label: 'Gate events',
    description: 'DM/group-chat windows. Often safe to disable.',
    triggers: ['OPEN_DMS', 'CLOSE_DMS', 'OPEN_GROUP_CHAT', 'CLOSE_GROUP_CHAT'],
  },
  {
    label: 'Cartridge lifecycle',
    description: 'Game/activity/dilemma start+end. Often noisy on long days.',
    triggers: ['START_GAME', 'END_GAME', 'START_ACTIVITY', 'END_ACTIVITY', 'DILEMMA', 'END_DILEMMA'],
  },
  {
    label: 'Confession booth',
    description: 'Suppresses automatically when scheduled in timeline.',
    triggers: ['CONFESSION_OPEN'],
  },
];

function effectiveValue(pushConfig: Record<string, boolean> | undefined, trigger: PushTrigger): boolean {
  if (pushConfig && trigger in pushConfig) return pushConfig[trigger]!;
  return DEFAULT_PUSH_CONFIG[trigger] ?? true;
}

export function PushConfigCard({ state, onCommand }: Props) {
  const pushConfig: Record<string, boolean> | undefined = state.manifest?.pushConfig;

  function toggle(trigger: PushTrigger) {
    const current = effectiveValue(pushConfig, trigger);
    onCommand({
      type: 'UPDATE_PUSH_CONFIG',
      pushConfig: { [trigger]: !current },
    });
  }

  function bulkSet(triggers: PushTrigger[], value: boolean) {
    const patch: Record<string, boolean> = {};
    for (const t of triggers) patch[t] = value;
    onCommand({ type: 'UPDATE_PUSH_CONFIG', pushConfig: patch });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Push Notifications</CardTitle>
        <p className="text-xs text-muted-foreground">
          Live patch — takes effect on the next push trigger. Connected clients
          aren't disrupted; manifest mutation doesn't refire SYNC.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{group.label}</div>
                <div className="text-[11px] text-muted-foreground">{group.description}</div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => bulkSet(group.triggers, true)}
                >
                  All on
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => bulkSet(group.triggers, false)}
                >
                  All off
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {group.triggers.map((trigger) => {
                const enabled = effectiveValue(pushConfig, trigger);
                const overridden = !!pushConfig && trigger in pushConfig;
                return (
                  <Button
                    key={trigger}
                    size="sm"
                    variant={enabled ? 'default' : 'outline'}
                    className="h-8 justify-start font-mono text-[11px]"
                    onClick={() => toggle(trigger)}
                    title={overridden ? 'Overridden on this game' : 'Default value (no override)'}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${
                        enabled ? 'bg-green-400' : 'bg-red-400'
                      }`}
                    />
                    {trigger}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
