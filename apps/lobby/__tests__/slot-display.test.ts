import { describe, it, expect } from 'vitest';
import { slotDisplayName } from '../lib/slot-display';

// The previous bug (audit 2026-05-03): apps/lobby/app/actions.ts inlined
//   `inv.display_name || inv.email?.split('@')[0] || null`
// at two sites (lines 334 + 1569). When a user had an email but no
// display_name, the slot data returned to OTHER players in the lobby
// included the email's local-part as the displayName — leaking real-name
// information that the persona system intentionally hides during play.
//
// `slotDisplayName` is the privacy-safe replacement. Any consumer needing
// a non-null label when display_name is null should fall through to
// persona name (see app/j/[code]/cast-helpers.ts displayLabelFor).

describe('slotDisplayName — privacy-safe display_name fallback', () => {
  it('returns trimmed display_name when present', () => {
    expect(slotDisplayName('Alice')).toBe('Alice');
    expect(slotDisplayName('  Alice  ')).toBe('Alice');
  });

  it('returns null when display_name is null or undefined', () => {
    expect(slotDisplayName(null)).toBeNull();
    expect(slotDisplayName(undefined)).toBeNull();
  });

  it('returns null for empty / whitespace-only display_name', () => {
    expect(slotDisplayName('')).toBeNull();
    expect(slotDisplayName('   ')).toBeNull();
    expect(slotDisplayName('\t\n')).toBeNull();
  });

  it('preserves internal whitespace in trimmed display_name', () => {
    expect(slotDisplayName('  Alice Smith  ')).toBe('Alice Smith');
  });
});
