import fs from 'fs';
import {
  DynamicManifestSchema,
  StaticManifestSchema,
  PeckingOrderRulesetSchema,
} from '@pecking-order/shared-types';

const GAME_SERVER = 'http://localhost:8787';

export async function fetchGameState(gameId: string): Promise<any> {
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/state`);
  if (!res.ok) {
    throw new Error(`Failed to fetch game state: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function validateDynamicManifest(state: any): string[] {
  const errors: string[] = [];
  const manifest = state?.manifest || state;

  if (!manifest) {
    errors.push('No manifest found in game state');
    return errors;
  }

  const manifestResult = DynamicManifestSchema.safeParse(manifest);
  if (!manifestResult.success) {
    for (const issue of manifestResult.error.issues) {
      errors.push(`manifest.${issue.path.join('.')}: ${issue.message}`);
    }
  }

  if (manifest.ruleset) {
    const rulesetResult = PeckingOrderRulesetSchema.safeParse(manifest.ruleset);
    if (!rulesetResult.success) {
      for (const issue of rulesetResult.error.issues) {
        errors.push(`ruleset.${issue.path.join('.')}: ${issue.message}`);
      }
    }
  }

  return errors;
}

export function validateStaticManifest(state: any, expectedDays?: number): string[] {
  const errors: string[] = [];
  const manifest = state?.manifest || state;

  if (!manifest) {
    errors.push('No manifest found');
    return errors;
  }

  const result = StaticManifestSchema.safeParse(manifest);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`manifest.${issue.path.join('.')}: ${issue.message}`);
    }
  }

  if (expectedDays && manifest.days?.length !== expectedDays) {
    errors.push(`Expected ${expectedDays} days, got ${manifest.days?.length}`);
  }

  return errors;
}

export function writeGameOutput(data: {
  gameId: string;
  inviteCode: string;
  mode: string;
  schedulePreset?: string;
  state?: any;
  schemaErrors: string[];
}): void {
  const output = {
    gameId: data.gameId,
    inviteCode: data.inviteCode,
    mode: data.mode,
    schedulePreset: data.schedulePreset,
    joinUrl: `http://localhost:3000/join/${data.inviteCode}`,
    stateUrl: `http://localhost:8787/parties/game-server/${data.gameId}/state`,
    manifest: data.state?.manifest,
    schemaValidation: {
      errors: data.schemaErrors,
      status: data.schemaErrors.length === 0 ? 'pass' : 'fail',
    },
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync('/tmp/pecking-order-lobby-game.json', JSON.stringify(output, null, 2));
}
