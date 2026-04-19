import { test, expect } from '@playwright/test';
import {
  createTestGame,
  advanceGameState,
  injectTimelineEvent,
  gotoGame,
  waitForGameShell,
} from '../fixtures/game-setup';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * T18 — end-to-end confession phase with privacy assertion.
 *
 * Validates the full stack:
 *   1. Server L3 confessionLayer opens on START_CONFESSION_CHAT (given ruleset.confessions.enabled=true)
 *   2. factToTicker emits a SOCIAL_PHASE ticker carrying channelId + kind='confession-open'
 *   3. Pulse ChatView renders it as a tappable narrator line
 *   4. Tapping opens the ConfessionBoothSheet
 *   5. Player posts via ConfessionInput — CONFESSION.POST round-trips
 *   6. SYNC broadcasts the post to both players anonymized (Confessor #N), never the real persona
 *   7. Each player sees a distinct `myHandle` (the per-recipient projection works)
 *   8. END_CONFESSION_CHAT closes the phase
 */
test.describe('Confession Phase — end-to-end', () => {
  test('phase opens, players post, posts are anonymized, privacy invariants hold', async ({ browser }) => {
    const game = await createTestGame(3, 2, {
      ruleset: { confessions: { enabled: true } },
    });

    // Drive to activeSession so L3 is running.
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Force Pulse shell via query param — CONFESSION UI is Pulse-only for now.
      await pageA.addInitScript(() => { sessionStorage.setItem('po_gate_deferred', '1'); });
      await pageB.addInitScript(() => { sessionStorage.setItem('po_gate_deferred', '1'); });

      await pageA.goto(`${CLIENT_URL}/game/${game.inviteCode}?_t=${game.players[0].token}&shell=pulse`);
      await pageB.goto(`${CLIENT_URL}/game/${game.inviteCode}?_t=${game.players[1].token}&shell=pulse`);
      await waitForGameShell(pageA);
      await waitForGameShell(pageB);

      // Trigger phase open — server-side guard requires ruleset.confessions.enabled=true AND 2+ alive.
      await injectTimelineEvent(game.gameId, 'START_CONFESSION_CHAT');
      await new Promise(r => setTimeout(r, 500));

      // SOCIAL_PHASE narrator line appears in both clients — tappable (role=button).
      const narratorA = pageA.getByText(/confession booth is open/i);
      const narratorB = pageB.getByText(/confession booth is open/i);
      await expect(narratorA).toBeVisible({ timeout: 10_000 });
      await expect(narratorB).toBeVisible({ timeout: 10_000 });

      // Open the booth on both clients by tapping the narrator line.
      await narratorA.click();
      await narratorB.click();

      // Booth dialog appears — look for the data-channel-type attribute.
      await expect(pageA.locator('[data-channel-type="CONFESSION"]')).toBeVisible({ timeout: 5_000 });
      await expect(pageB.locator('[data-channel-type="CONFESSION"]')).toBeVisible({ timeout: 5_000 });

      // --- Privacy Invariant 1: each player sees a distinct "my handle" ---
      const handleA = await pageA
        .locator('[data-testid="my-confessor-handle"]')
        .textContent({ timeout: 5_000 });
      const handleB = await pageB
        .locator('[data-testid="my-confessor-handle"]')
        .textContent({ timeout: 5_000 });
      expect(handleA).toMatch(/CONFESSOR · \d+/i);
      expect(handleB).toMatch(/CONFESSOR · \d+/i);
      expect(handleA).not.toBe(handleB);

      // --- Player A posts ---
      const composerA = pageA.getByPlaceholder(/speak into the mic/i);
      await composerA.fill('the truth is i hate mondays');
      await pageA.getByRole('button', { name: /go on air/i }).click();

      // --- Privacy Invariant 2: both players see the post text anonymized ---
      await expect(pageA.getByText('the truth is i hate mondays')).toBeVisible({ timeout: 10_000 });
      await expect(pageB.getByText('the truth is i hate mondays')).toBeVisible({ timeout: 10_000 });

      // Player A's persona name must not appear on Player B's screen in the booth.
      const playerAPersona = game.players[0].personaName;
      const boothBText = await pageB.locator('[data-channel-type="CONFESSION"]').textContent();
      expect(boothBText).not.toContain(playerAPersona);

      // --- Trigger phase close ---
      await injectTimelineEvent(game.gameId, 'END_CONFESSION_CHAT');
      await new Promise(r => setTimeout(r, 500));

      // Booth drops "ON AIR" ticker; the dialog may remain mounted depending on
      // UX (we keep the sheet open so archived tapes stay browsable — design
      // parity with mockup 13's state 04). At minimum the OFF AIR pip should
      // appear somewhere in the chrome. If the dialog IS closed by close-on-end,
      // pass either way.
      const offAirVisible = await pageA.getByText(/off air/i).isVisible({ timeout: 3_000 }).catch(() => false);
      const dialogDismissed = await pageA
        .locator('[data-channel-type="CONFESSION"]')
        .isHidden({ timeout: 3_000 })
        .catch(() => false);
      expect(offAirVisible || dialogDismissed).toBe(true);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
