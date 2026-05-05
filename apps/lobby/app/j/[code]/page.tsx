import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getDB, getEnv } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { BrowserSupportGate } from '@/components/BrowserSupportGate';
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
  const description = 'Catfish your friends. Vote. Ally. Betray. Survive. A social deduction game in your group chat. Last catfish wins.';
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
      'SELECT id, status, invite_code, player_count FROM GameSessions WHERE invite_code = ?',
    )
    .bind(code.toUpperCase())
    .first<{ id: string; status: string; invite_code: string; player_count: number }>();

  if (!game) notFound();

  // Resolve session + enrollment up front so already-joined players who
  // return to the email link AFTER game start bypass the "no longer
  // accepting players" wall and get funneled into /play. The previous
  // ordering ran the !isAcceptingPlayers gate first, which blocked enrolled
  // players too — surfaced once PR #130 began flipping STARTED at the
  // right moment instead of leaving CC games stuck at RECRUITING.
  //
  // D1 is eventually-consistent across replicas; an Invites row written
  // sub-second ago might miss here and show the welcome form instead of
  // redirecting. Next reload picks it up. Acceptable residual gap.
  const session = await getSession();
  const enrolled = session
    ? !!(await db
        .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
        .bind(game.id, session.userId)
        .first())
    : false;

  // Already-joined player coming back to a started/completed game →
  // /play mints a fresh JWT and forwards into the client.
  if (enrolled && (game.status === 'STARTED' || game.status === 'COMPLETED')) {
    redirect(`/play/${code}`);
  }

  const isAcceptingPlayers = game.status === 'RECRUITING' || game.status === 'READY';

  if (!isAcceptingPlayers) {
    // Unenrolled visitor (or admin-archived game) post-start. Genuinely
    // can't join.
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

  // Authed + not enrolled + still accepting → persona pick.
  // Anon OR authed + enrolled + pre-start → fall through to the welcome
  // view so the visitor sees the joined cast + social context. /play
  // would otherwise bounce pre-start players into /game/CODE/waiting
  // (host panel, reads as empty for non-host enrolled players).
  if (session && !enrolled) {
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
    <BrowserSupportGate>
    <div className="relative min-h-dvh flex items-start justify-center bg-skin-deep px-4 py-6 sm:px-6 sm:py-8 overflow-hidden">
      {/* Background tint comes from --po-gradient-bg in the tabloid theme —
          subtle red radial on ink ground. No inline pink radial; that
          competed with the page's red accent. */}

      <div className="relative w-full max-w-md flex flex-col gap-6 sm:gap-7">

        {/* Masthead — wordmark left, tear-off code stub right. 2px paper rule
            anchors the page as a magazine cover. Wordmark up to text-lg
            from text-base for the bolder pass — masthead is the page-
            level masthead, it should announce, not whisper. */}
        <div className="flex items-center justify-between pb-2.5 border-b-2 border-skin-base">
          <div className="font-display font-black text-lg text-skin-base tracking-[0.16em] uppercase leading-none">
            Pecking Order
          </div>
          <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-skin-dim leading-none">
            <span className="opacity-60 mr-1">CODE</span>
            <span className="text-skin-base">{game.invite_code.toUpperCase()}</span>
          </div>
        </div>

        {/* Cast forming → photo fan + named-cast meta line.
            Empty state → "First in" red tag. */}
        {hasCast ? (
          <div className="space-y-3">
            <JoinedCast players={players} assetsUrl={assetsUrl} />
            <p className="text-center text-[13px] text-skin-base leading-snug px-2">
              {socialLine}{' '}
              <span className="text-skin-dim font-medium">Tap in to join them.</span>
            </p>
          </div>
        ) : (
          <div className="flex justify-center pt-1">
            <span className="inline-flex items-center bg-skin-pink text-skin-base px-2.5 py-1 rounded font-display font-black text-[10px] tracking-[0.22em] uppercase">
              First in · You set the room
            </span>
          </div>
        )}

        {/* Hero — kicker (cast forming only), headline, dek. "Catfish" surfaces
            in red as the load-bearing concept word. */}
        <div className={`${hasCast ? 'border-b border-skin-rule pb-4' : 'text-center'}`}>
          {hasCast && (
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="inline-block w-6 h-px bg-skin-pink" />
              <span className="font-display font-black text-[10px] tracking-[0.32em] uppercase text-skin-pink leading-none">
                Casting Call
              </span>
            </div>
          )}
          <h1
            className="font-display font-black tracking-tight leading-[0.86] text-skin-base mb-2"
            style={{ fontSize: 'clamp(2.6rem, 12vw, 3.85rem)' }}
          >
            You’re <span className="text-skin-pink">{hasCast ? 'invited.' : 'in first.'}</span>
          </h1>
          <p className={`text-sm text-skin-dim leading-relaxed max-w-[32ch] ${hasCast ? '' : 'mx-auto'}`}>
            <span className="text-skin-pink font-bold">Catfish</span> your friends.{' '}
            {hasCast ? (
              <>Vote them out. <strong className="text-skin-base font-semibold">Last catfish wins.</strong></>
            ) : (
              <>Last catfish wins. <strong className="text-skin-base font-semibold">The room fills as your friends accept.</strong></>
            )}
          </p>
        </div>

        {/* Verb stack — empty-state visual replacing the cast fan. Pushed
            from clamp(2/9.5vw/2.75) to clamp(2.4/11.5vw/3.4) for the
            bolder pass — when there's no cast yet, this stack carries
            the visual weight of the page; needs to feel like a tabloid
            cover, not a list. Tighter leading [0.9] keeps the four
            words stacked tight so they read as one block. */}
        {!hasCast && (
          <div
            aria-hidden
            className="text-center font-display font-black uppercase leading-[0.9] tracking-tight border-y border-skin-rule py-4"
            style={{ fontSize: 'clamp(2.4rem, 11.5vw, 3.4rem)' }}
          >
            <div className="text-skin-base">Vote.</div>
            <div className="text-skin-pink">Ally.</div>
            <div className="text-skin-base">Betray.</div>
            <div className="text-skin-pink">Survive.</div>
          </div>
        )}

        {/* Rhythm strip — cold-player intro per /harden onboarding rules.
            Three reality-TV verbs; mechanism in italic sub-labels. Foot
            conveys multi-day async without committing to a specific count. */}
        <div className="border-y border-skin-rule py-3">
          <div className="text-center font-display font-black text-[10px] tracking-[0.28em] uppercase text-skin-pink mb-2.5">
            Each day
          </div>
          {/* Verbs pushed 22px → 27px for the bolder pass — these are the
              load-bearing nouns of the rhythm strip and were reading as
              UI labels rather than headlines. Step numbers stay 10px
              tracked-caps red (eyebrow grammar; principle 2 — loud through
              contrast, not hue). */}
          <div className="grid grid-cols-3 gap-1">
            <div className="text-center px-1 border-r border-skin-rule">
              <div className="font-display font-black text-[10px] tracking-[0.16em] text-skin-pink leading-none">01</div>
              <div className="font-display font-black text-[27px] tracking-[-0.01em] uppercase text-skin-base leading-[0.95] mt-1">Scheme</div>
              <div className="text-[11px] italic text-skin-dim mt-1 leading-tight">alliances and rivalries</div>
            </div>
            <div className="text-center px-1 border-r border-skin-rule">
              <div className="font-display font-black text-[10px] tracking-[0.16em] text-skin-pink leading-none">02</div>
              <div className="font-display font-black text-[27px] tracking-[-0.01em] uppercase text-skin-base leading-[0.95] mt-1">Compete</div>
              <div className="text-[11px] italic text-skin-dim mt-1 leading-tight">daily games for silver</div>
            </div>
            <div className="text-center px-1">
              <div className="font-display font-black text-[10px] tracking-[0.16em] text-skin-pink leading-none">03</div>
              <div className="font-display font-black text-[27px] tracking-[-0.01em] uppercase text-skin-base leading-[0.95] mt-1">Betray</div>
              <div className="text-[11px] italic text-skin-dim mt-1 leading-tight">vote one out</div>
            </div>
          </div>
          <p className="text-center text-[11px] text-skin-dim mt-2.5 leading-tight">
            Plays out <strong className="text-skin-base font-bold">day after day</strong>. Until only one{' '}
            <span className="text-skin-pink font-bold">catfish</span> remains.
          </p>
        </div>

        {/* Real-name form — collects player's real name with privacy contract */}
        <WelcomeForm code={game.invite_code} />

        {/* Page footer-line */}
        <p className="text-center text-[11px] text-skin-faint tracking-wide pb-safe pt-1">
          One round a day · One leaves each round ·{' '}
          <span className="text-skin-pink font-bold tracking-[0.12em]">Last catfish wins</span>
        </p>
      </div>
    </div>
    </BrowserSupportGate>
  );
}
