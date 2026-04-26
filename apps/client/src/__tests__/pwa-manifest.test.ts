/**
 * Unit tests for the PWA manifest builder used by ADR-149.
 *
 * The contract:
 *   - `updatePwaManifest()` with no args → `start_url: '${origin}/'` (launcher fallback)
 *   - `updatePwaManifest(code, jwt)` with both → `start_url: '${origin}/game/<code>?_t=<jwt>'`
 *   - The function writes the manifest as a `data:` URL on `<link rel="manifest">`,
 *     creating the link element if missing.
 *
 * If the contract changes, this fails loudly. Especially relevant for the
 * `getGameCodeFromPath` regex pairing (App.tsx:79-82): the regex accepts
 * `[A-Za-z0-9]+` and the cold launch URL must satisfy that — passing a
 * hyphenated `game-<ts>-<rand>` here would produce a manifest the cold launch
 * cannot resolve.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bakeManifestForActiveGame, updatePwaManifest } from '../App';

function readManifest(): { start_url: string; scope: string } | null {
  const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) return null;
  const href = link.getAttribute('href');
  if (!href?.startsWith('data:application/json')) return null;
  // `data:application/json;charset=utf-8,<encoded-json>`
  const encoded = href.slice(href.indexOf(',') + 1);
  return JSON.parse(decodeURIComponent(encoded));
}

describe('updatePwaManifest', () => {
  const origin = 'http://localhost:3000';

  beforeEach(() => {
    // jsdom defaults to http://localhost:3000 — match that for assertions
    // and reset any pre-existing <link rel="manifest"> between cases.
    document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
  });

  it('falls back to launcher-only start_url when called without args', () => {
    updatePwaManifest();
    const manifest = readManifest();
    expect(manifest).not.toBeNull();
    expect(manifest!.start_url).toBe(`${origin}/`);
    expect(manifest!.scope).toBe(`${origin}/`);
  });

  it('bakes /game/CODE?_t=<jwt> when called with both args', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtYWNrIn0.sig';
    updatePwaManifest('M4P9BG', jwt);
    const manifest = readManifest();
    expect(manifest).not.toBeNull();
    expect(manifest!.start_url).toBe(`${origin}/game/M4P9BG?_t=${jwt}`);
    // Scope must remain origin-rooted so the PWA window controls the whole site.
    expect(manifest!.scope).toBe(`${origin}/`);
  });

  it('falls back to launcher-only when only one arg is provided', () => {
    // Defensive: if a caller passes gameCode without jwt (or vice versa) the
    // start_url contract cannot be satisfied. The function treats this as
    // "missing args" and falls back to '/'.
    updatePwaManifest('M4P9BG');
    expect(readManifest()!.start_url).toBe(`${origin}/`);

    updatePwaManifest(undefined, 'jwt-without-code');
    expect(readManifest()!.start_url).toBe(`${origin}/`);
  });

  it('updates an existing <link rel="manifest"> in place rather than appending duplicates', () => {
    const existing = document.createElement('link');
    existing.rel = 'manifest';
    existing.href = '/manifest.webmanifest';
    document.head.appendChild(existing);

    updatePwaManifest('CODE1', 'jwt1');
    expect(document.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(readManifest()!.start_url).toBe(`${origin}/game/CODE1?_t=jwt1`);

    // A second call replaces the URL on the same element — multi-game users
    // see whichever code last entered, which ADR-149's "Consequences" calls
    // out as the multi-game tradeoff.
    updatePwaManifest('CODE2', 'jwt2');
    expect(document.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(readManifest()!.start_url).toBe(`${origin}/game/CODE2?_t=jwt2`);
  });

  describe('bakeManifestForActiveGame (call-site guard)', () => {
    // Locks in the contract that `applyToken(jwt, null, …)` (debug `?token=`
    // entry) does NOT bake a tokenised manifest. Without this guard, the
    // baked URL would use `decoded.gameId` ("game-<ts>-<rand>") which the
    // cold-launch regex `[A-Za-z0-9]+` rejects, producing a manifest no
    // human flow can resolve. This is the call-site invariant; the
    // function-level invariants live in the suite above.

    it('does NOT bake the manifest when gameCode is null (debug ?token= path)', () => {
      // Establish a launcher baseline first so we can assert it doesn't change.
      updatePwaManifest();
      const before = readManifest()!;
      expect(before.start_url).toBe(`${origin}/`);

      bakeManifestForActiveGame(null, 'eyJhbGciOiJIUzI1NiJ9.payload.sig');

      const after = readManifest()!;
      expect(after.start_url).toBe(`${origin}/`);
    });

    it('bakes the manifest when gameCode is present', () => {
      bakeManifestForActiveGame('M4P9BG', 'jwt-value');
      expect(readManifest()!.start_url).toBe(`${origin}/game/M4P9BG?_t=jwt-value`);
    });
  });

  it('produces a start_url whose path matches getGameCodeFromPath regex', () => {
    // Tightly coupled to App.tsx getGameCodeFromPath: /^\/game\/([A-Za-z0-9]+)\/?$/.
    // If anyone broadens that regex to accept hyphens in codes, the call site
    // guard in applyToken can drop its null-check — but until then, this
    // assertion guards the invariant that the baked URL is resolvable on cold
    // launch.
    const codeRegex = /^[A-Za-z0-9]+$/;
    const code = 'M4P9BG';
    expect(codeRegex.test(code)).toBe(true);

    updatePwaManifest(code, 'jwt');
    const manifest = readManifest()!;
    const url = new URL(manifest.start_url);
    const match = url.pathname.match(/^\/game\/([A-Za-z0-9]+)\/?$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(code);
  });
});
