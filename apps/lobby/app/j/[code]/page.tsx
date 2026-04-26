import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getDB, getEnv } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { WelcomeForm } from './welcome-form';
import { JoinedCast } from './joined-cast';
import { buildSocialLine, displayLabelFor, type JoinedPlayer } from './cast-helpers';

interface PageProps {
  params: Promise<{ code: string }>;
}

// Per-link OG metadata. The previous behavior fell through to the root
// layout's "Pecking Order — A social game of..." generic copy, so every
// invite link unfurled identically in iMessage / WhatsApp / Discord
// regardless of who sent it. This generates a contextual unfurl card per
// invite: when the host's persona is known, name it; otherwise lean on
// the brand mantra. Always falls back gracefully — if the game/code
// doesn't exist, the page itself 404s and the unfurl never matters.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const env = await getEnv();
  const lobbyHost = (env.LOBBY_HOST as string) || 'https://lobby.peckingorder.ca';
  const ogImage = `${lobbyHost}/og-playtest.png`;

  let hostLabel: string | null = null;
  try {
    const db = await getDB();
    // Host = the persona who created the game. Pull their persona name for
    // unfurl context. One lightweight query at metadata time; runs in
    // parallel with page rendering on the same request.
    const row = await db
      .prepare(
        `SELECT pp.name AS persona_name
         FROM GameSessions gs
         INNER JOIN Invites i ON i.game_id = gs.id AND i.accepted_by = gs.host_user_id
         LEFT JOIN PersonaPool pp ON pp.id = i.persona_id
         WHERE gs.invite_code = ?
         LIMIT 1`,
      )
      .bind(code.toUpperCase())
      .first<{ persona_name: string | null }>();
    hostLabel = row?.persona_name ?? null;
  } catch {
    // DB failure shouldn't block metadata. Fall back to mantra-only copy.
  }

  const title = hostLabel
    ? `${hostLabel} added you to Pecking Order`
    : `You're invited to Pecking Order`;
  const description = 'Vote. Ally. Betray. Survive. A social deduction game in your group chat. Seven days. One winner.';
  const url = `${lobbyHost}/j/${code.toUpperCase()}`;

  return {
    metadataBase: new URL(lobbyHost),
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Pecking Order',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'Pecking Order — Vote. Ally. Betray. Survive.' }],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
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

  // Short-circuit based on visitor session:
  //   authed + not enrolled    → /join (persona pick)
  //   authed + enrolled + STARTED → /play (into the running game)
  //   anon OR authed + enrolled + pre-start → fall through to the welcome
  //     view so the visitor sees the joined cast + social context. /play
  //     would bounce pre-start players into /game/CODE/waiting (host
  //     panel, reads as empty for non-host enrolled players).
  // D1 is eventually-consistent across replicas; an Invites row written
  // sub-second ago might miss here and show the welcome form instead of
  // redirecting. Next reload picks it up. Acceptable residual gap.
  const session = await getSession();
  if (session) {
    const enrolled = await db
      .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
      .bind(game.id, session.userId)
      .first();
    if (!enrolled) redirect(`/join/${code}`);
    if (game.status === 'STARTED' || game.status === 'COMPLETED') redirect(`/play/${code}`);
    // enrolled + RECRUITING/READY → render the welcome view below.
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
          <p className="text-[10px] font-display font-bold text-skin-gold uppercase tracking-[0.3em]">
            Pecking Order
          </p>
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

        {/* Brand verb-stack — only on the empty state. With cast present, the
            JoinedCast component IS the visual interest; the verb stack here
            would compete. With no cast, the page would otherwise be a logo
            + headline + form — the stack fills that void with the same brand
            mantra used on /playtest and in invite emails. */}
        {!hasCast && (
          <div
            aria-hidden
            className="text-center font-display font-black uppercase leading-[0.92] tracking-tight"
            style={{ fontSize: 'clamp(2.25rem, 10vw, 3.5rem)' }}
          >
            <div className="text-skin-base">Vote.</div>
            <div className="text-skin-gold">Ally.</div>
            <div className="text-skin-base">Betray.</div>
            <div className="text-skin-pink">Survive.</div>
          </div>
        )}

        <WelcomeForm code={game.invite_code} />

        <p className="text-center text-[11px] text-skin-dim tracking-wide">
          Seven days. One winner. Don’t get voted out.
        </p>
      </div>
    </div>
  );
}
