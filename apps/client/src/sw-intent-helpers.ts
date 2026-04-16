import type { DeepLinkIntent } from '@pecking-order/shared-types';

const VALID_KINDS = new Set([
  'main', 'dm', 'dm_invite', 'cartridge_active', 'cartridge_result',
  'elimination_reveal', 'winner_reveal',
]);

export function parseIntentFromData(data: any): DeepLinkIntent | null {
  if (!data || typeof data.intent !== 'string') return null;
  try {
    const parsed = JSON.parse(data.intent);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string') return null;
    if (!VALID_KINDS.has(parsed.kind)) return null;
    return parsed as DeepLinkIntent;
  } catch {
    return null;
  }
}

export function buildIntentUrl(baseUrl: string, intent: DeepLinkIntent): string {
  const b64 = btoa(JSON.stringify(intent));
  return baseUrl.includes('?') ? `${baseUrl}&intent=${b64}` : `${baseUrl}?intent=${b64}`;
}
