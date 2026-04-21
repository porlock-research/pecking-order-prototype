import { notFound } from 'next/navigation';
import { getDB } from '@/lib/db';
import { WelcomeForm } from './welcome-form';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function FrictionlessWelcomePage({ params }: PageProps) {
  const { code } = await params;
  const db = await getDB();

  const game = await db
    .prepare(
      'SELECT id, status, invite_code, player_count FROM GameSessions WHERE invite_code = ?',
    )
    .bind(code.toUpperCase())
    .first<{ id: string; status: string; invite_code: string; player_count: number }>();

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

  const acceptedCount = await db
    .prepare(
      'SELECT COUNT(*) as n FROM Invites WHERE game_id = ? AND accepted_by IS NOT NULL',
    )
    .bind(game.id)
    .first<{ n: number }>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-skin-deep p-6">
      <div className="max-w-md w-full space-y-6">
        <header className="text-center space-y-2">
          <div className="text-[10px] font-display font-bold text-skin-accent uppercase tracking-[0.3em]">
            Pecking Order
          </div>
          <h1 className="font-display text-3xl font-black text-skin-base leading-tight">
            You&rsquo;re invited to a game
          </h1>
          <p className="text-sm text-skin-dim">
            {acceptedCount?.n ?? 0} of {game.player_count} joined &mdash; don&rsquo;t wait too
            long.
          </p>
        </header>
        <WelcomeForm code={game.invite_code} />
      </div>
    </div>
  );
}
