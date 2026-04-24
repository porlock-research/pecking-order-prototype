import { notFound, redirect } from 'next/navigation';
import { getDB, getEnv } from '@/lib/db';
import { getSession } from '@/lib/auth';
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
      <div className="min-h-dvh flex items-center justify-center bg-skin-deep px-5 py-8">
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

  // Short-circuit based on visitor session. Anon visitors fall through to
  // the welcome form below. Authed players either continue into /play
  // (already enrolled) or /join (need persona pick).
  // D1 is eventually-consistent across replicas; an Invites row written
  // sub-second ago might miss here and show the welcome form instead of
  // redirecting. The next reload picks it up. Acceptable residual gap.
  const session = await getSession();
  if (session) {
    const enrolled = await db
      .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
      .bind(game.id, session.userId)
      .first();
    if (enrolled) redirect(`/play/${code}`);
    redirect(`/join/${code}`);
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
    <div className="relative min-h-dvh flex items-center justify-center bg-skin-deep px-4 py-8 sm:px-6 sm:py-10 overflow-hidden">
      {/* Warm radial tint — pulls attention center, respects skin-deep palette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 28%, rgba(236,72,153,0.12), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-md space-y-7 sm:space-y-8">
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
            // Fluid headline — 2rem on ~320px phones, 3.25rem on tablets+.
            style={{ fontSize: 'clamp(2rem, 8vw + 0.25rem, 3.25rem)' }}
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
