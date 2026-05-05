'use client';

import { useState, useTransition } from 'react';
import { claimSeat } from './actions';

export function WelcomeForm({ code }: { code: string }) {
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (handle.trim().length === 0) {
      setError('Name your character first.');
      return;
    }
    startTransition(async () => {
      const result = await claimSeat(code, handle);
      if (!result.ok) {
        switch (result.error) {
          case 'invalid_handle':
            setError('Name must be 1-24 characters.');
            break;
          case 'rate_limited':
            setError('Too many tries from this network. Give it a sec.');
            break;
          case 'game_not_found':
            setError('Game not found.');
            break;
          case 'game_not_accepting':
            setError('This game already started.');
            break;
          default:
            setError('Something went sideways. Try again.');
        }
      }
      // Success: the server action redirected, this callback never reaches here.
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <label className="block">
        <span className="block text-[11px] font-bold text-skin-dim uppercase tracking-[0.18em] font-display">
          Your real name
        </span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoFocus
          autoComplete="given-name"
          maxLength={24}
          placeholder="Your real name"
          className="mt-2 w-full px-4 py-3 bg-skin-input border border-skin-rule rounded-lg text-skin-base placeholder:text-skin-faint focus:outline-none focus:border-skin-pink/60 text-base"
        />
        <span className="mt-2 block text-[11.5px] text-skin-dim leading-snug">
          <strong className="text-skin-base font-semibold">Stays hidden</strong> while you play. Other players see your{' '}
          <span className="text-skin-pink font-semibold">persona</span>. Revealed at the end.
        </span>
      </label>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm"
        >
          {error}
        </div>
      )}

      {/* Primary commit CTA — pushed bigger + harder for the bolder pass.
          The shadow-bevel uses --po-pink-depth (the dedicated shadow
          tone) to give the button physical depth instead of a generic
          drop shadow; press translates the button down 2px and shrinks
          the bevel for tactile feedback. Type bumped 15px→16px and
          tracking 0.22em→0.24em to feel like reality-TV title-card,
          not utility chrome. */}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        style={{
          boxShadow:
            '0 4px 0 var(--po-pink-depth), 0 10px 24px -6px rgba(215,38,56,0.42)',
        }}
        className="w-full min-h-[60px] py-5 bg-skin-pink text-skin-base font-display font-black text-base uppercase tracking-[0.24em] rounded-lg disabled:opacity-50 transition-[transform,box-shadow] active:translate-y-[2px] active:[box-shadow:0_2px_0_var(--po-pink-depth),0_6px_14px_-4px_rgba(215,38,56,0.35)]"
      >
        {isPending ? 'Stepping in…' : 'Step in →'}
      </button>
    </form>
  );
}
