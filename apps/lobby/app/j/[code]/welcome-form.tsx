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
        <span className="block text-xs font-bold text-skin-dim uppercase tracking-widest">
          What should we call you?
        </span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoFocus
          autoComplete="given-name"
          maxLength={24}
          placeholder="Your name"
          className="mt-2 w-full px-4 py-3 bg-skin-input border border-skin-base rounded-xl text-skin-base placeholder:text-skin-dim/70 focus:outline-none focus:border-skin-gold/50 text-base"
        />
        <span className="mt-2 block text-xs text-skin-base/70 leading-snug">
          This is so the group knows you in-game and in the reveal at the end.
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

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full min-h-[52px] py-4 bg-skin-gold text-skin-deep font-display font-black text-sm uppercase tracking-widest rounded-xl disabled:opacity-50 active:scale-[0.99] transition-transform"
      >
        {isPending ? 'Joining…' : "Let's go →"}
      </button>
    </form>
  );
}
