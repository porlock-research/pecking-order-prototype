import { notFound } from 'next/navigation';
import { getDB, getEnv } from '@/lib/db';
import { WelcomeForm } from './welcome-form';
import { JoinedCast } from './joined-cast';
import { buildSocialLine, displayLabelFor, type JoinedPlayer } from './cast-helpers';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function FrictionlessWelcomePage({ params }: PageProps) {
  const { code } = await params;
  const db = await getDB();
  const env = await getEnv();
  const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';

  const game = await db
    .prepare(
      'SELECT id, status, invite_code FROM GameSessions WHERE invite_code = ?',
    )
    .bind(code.toUpperCase())
    .first<{ id: string; status: string; invite_code: string }>();

  if (!game) notFound();

  const isAcceptingPlayers = game.status === 'RECRUITING' || game.status === 'READY';

  if (!isAcceptingPlayers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-skin-deep p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display text-2xl font-black text-skin-dim">
            This game already started
          </h1>
          <p className="text-sm text-skin-dim/80">
            The host kicked off before you tapped in. Ask your friends to start a new game and
            share the link before they begin.
          </p>
        </div>
      </div>
    );
  }

  // Joined cast: fetch up to 6 accepted players with persona + user labels,
  // ordered by acceptance time so first-joiners appear first in the fan.
  const { results: joinedRows } = await db
    .prepare(
      `SELECT i.persona_id   AS persona_id,
              pp.name         AS persona_name,
              pp.stereotype   AS persona_stereotype,
              u.display_name  AS display_name,
              u.contact_handle AS contact_handle
       FROM Invites i
       INNER JOIN PersonaPool pp ON pp.id = i.persona_id
       LEFT JOIN Users u ON u.id = i.accepted_by
       WHERE i.game_id = ?
         AND i.accepted_by IS NOT NULL
         AND i.persona_id IS NOT NULL
       ORDER BY i.accepted_at ASC
       LIMIT 6`,
    )
    .bind(game.id)
    .all<{
      persona_id: string;
      persona_name: string;
      persona_stereotype: string;
      display_name: string | null;
      contact_handle: string | null;
    }>();

  const players: JoinedPlayer[] = joinedRows.map((r) => ({
    personaId: r.persona_id,
    personaName: r.persona_name,
    personaStereotype: r.persona_stereotype,
    displayLabel: displayLabelFor({
      displayName: r.display_name,
      contactHandle: r.contact_handle,
      personaName: r.persona_name,
    }),
  }));

  const socialLine = buildSocialLine(players.map((p) => p.displayLabel));
  const hasCast = players.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-skin-deep p-6 overflow-hidden">
      {/* Warm radial tint — pulls attention center, respects skin-deep palette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 28%, rgba(236,72,153,0.12), transparent 70%)',
        }}
      />

      <div className="relative max-w-md w-full space-y-7">
        {hasCast && (
          <div className="pt-2">
            <JoinedCast players={players} assetsUrl={assetsUrl} />
          </div>
        )}

        <header className="text-center space-y-3">
          <div className="text-[10px] font-display font-bold text-skin-accent uppercase tracking-[0.3em]">
            Pecking Order
          </div>
          <h1
            className="font-display font-black text-skin-base leading-[0.95]"
            style={{ fontSize: 'clamp(2rem, 7vw + 0.5rem, 3rem)' }}
          >
            {hasCast ? 'You’re invited.' : 'You’re in first.'}
          </h1>
          <p className="text-[15px] text-skin-dim max-w-[30ch] mx-auto leading-snug">
            {socialLine}
          </p>
        </header>

        <WelcomeForm code={game.invite_code} />
      </div>
    </div>
  );
}
