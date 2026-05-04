/**
 * Sanitize a user's stored `display_name` for safe inclusion in slot data
 * returned to other players.
 *
 * Returns the trimmed `display_name` if present and non-blank; otherwise
 * `null`.
 *
 * **Privacy contract** — this helper MUST NEVER fall back to email-derived
 * strings (e.g. `email.split('@')[0]`). The local-part of an email leaks
 * real-name information that the persona system intentionally hides from
 * other players during play. Two earlier sites in `app/actions.ts` had
 * this fallback inlined (audit 2026-05-03); they were replaced with this
 * helper.
 *
 * If a consumer needs a non-null label when `display_name` is null, fall
 * through to the persona name — see `app/j/[code]/cast-helpers.ts`
 * `displayLabelFor`, which already does this client-side.
 */
export function slotDisplayName(displayName: string | null | undefined): string | null {
  if (!displayName) return null;
  const trimmed = displayName.trim();
  return trimmed.length > 0 ? trimmed : null;
}
