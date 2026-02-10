/**
 * Pecking Order — Tailwind CSS Preset
 *
 * Maps --po-* CSS custom properties to Tailwind utility classes.
 * Usage: presets: [require('@pecking-order/ui-kit/tailwind-preset')]
 *
 * Classes use the `skin-*` prefix for theming, e.g.:
 *   bg-skin-deep, text-skin-gold, border-skin-base
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
    theme: {
        extend: {
            colors: {
                skin: {
                    // Core theme tokens
                    deep: 'var(--po-bg-deep)',
                    panel: 'var(--po-bg-panel)',
                    input: 'var(--po-bg-input)',
                    bubble: 'var(--po-bg-bubble)',
                    glass: 'var(--po-bg-glass)',
                    gold: 'var(--po-gold)',
                    'gold-dim': 'var(--po-gold-dim)',
                    pink: 'var(--po-pink)',
                    'pink-depth': 'var(--po-pink-depth)',
                    green: 'var(--po-green)',
                    'green-dim': 'var(--po-green-dim)',
                    orange: 'var(--po-orange)',
                    danger: 'var(--po-danger)',
                    info: 'var(--po-info)',

                    // Legacy aliases (client app uses these names)
                    fill: 'var(--po-bg-deep)',
                    surface: 'var(--po-bg-panel)',
                    primary: 'var(--po-gold)',
                    secondary: 'var(--po-pink)',
                },
            },
            textColor: {
                skin: {
                    // Core
                    base: 'var(--po-text)',
                    dim: 'var(--po-text-dim)',
                    inverted: 'var(--po-text-inverted)',
                    gold: 'var(--po-gold)',
                    pink: 'var(--po-pink)',
                    green: 'var(--po-green)',
                    orange: 'var(--po-orange)',
                    danger: 'var(--po-danger)',
                    info: 'var(--po-info)',

                    // Legacy aliases
                    primary: 'var(--po-gold)',
                    secondary: 'var(--po-pink)',
                    muted: 'var(--po-text-dim)',
                },
            },
            backgroundColor: {
                skin: {
                    // Core
                    deep: 'var(--po-bg-deep)',
                    panel: 'var(--po-bg-panel)',
                    input: 'var(--po-bg-input)',
                    bubble: 'var(--po-bg-bubble)',
                    glass: 'var(--po-bg-glass)',
                    gold: 'var(--po-gold)',
                    pink: 'var(--po-pink)',
                    green: 'var(--po-green)',
                    danger: 'var(--po-danger)',
                    info: 'var(--po-info)',

                    // Legacy aliases
                    fill: 'var(--po-bg-deep)',
                    surface: 'var(--po-bg-panel)',
                    primary: 'var(--po-gold)',
                    secondary: 'var(--po-pink)',
                },
            },
            borderColor: {
                skin: {
                    base: 'var(--po-border)',
                    active: 'var(--po-border-active)',
                    gold: 'var(--po-gold)',
                    pink: 'var(--po-pink)',
                    green: 'var(--po-green)',
                    orange: 'var(--po-orange)',
                    info: 'var(--po-info)',

                    // Legacy aliases
                    primary: 'var(--po-gold)',
                    secondary: 'var(--po-pink)',
                    danger: 'var(--po-danger)',
                    muted: 'var(--po-text-dim)',
                },
            },
            ringColor: {
                skin: {
                    gold: 'var(--po-gold)',
                    pink: 'var(--po-pink)',
                    green: 'var(--po-green)',
                    orange: 'var(--po-orange)',
                    info: 'var(--po-info)',

                    // Legacy aliases
                    primary: 'var(--po-gold)',
                    secondary: 'var(--po-pink)',
                    danger: 'var(--po-danger)',
                },
            },
            fontFamily: {
                display: ['var(--po-font-display)'],
                body: ['var(--po-font-body)'],
                mono: ['var(--po-font-mono)'],
            },
            borderRadius: {
                card: 'var(--po-radius-card)',
                bubble: 'var(--po-radius-bubble)',
                pill: 'var(--po-radius-pill)',
                badge: 'var(--po-radius-badge)',
            },
            boxShadow: {
                card: 'var(--po-shadow-card)',
                glow: 'var(--po-shadow-glow)',
                btn: 'var(--po-shadow-btn)',
            },
            animation: {
                'pulse-live': 'pulse-live 2s ease-in-out infinite',
                'slide-up-in': 'slide-up-in 300ms ease-out both',
                'shimmer': 'shimmer 3s ease-in-out infinite',
                'flash-update': 'flash-update 500ms ease-out',
                'badge-pop': 'badge-pop 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                'glow-breathe': 'glow-breathe 3s ease-in-out infinite',
                'spin-slow': 'spin-slow 8s linear infinite',
                'fade-in': 'fade-in 200ms ease-out both',
                'elimination-reveal': 'elimination-reveal 600ms ease-out forwards',
                'count-pop': 'count-pop 300ms ease-out',
            },
            keyframes: {
                'pulse-live': {
                    '0%, 100%': { transform: 'scale(1)', opacity: '1' },
                    '50%': { transform: 'scale(1.08)', opacity: '0.85' },
                },
                'slide-up-in': {
                    from: { opacity: '0', transform: 'translateY(12px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% center' },
                    '100%': { backgroundPosition: '200% center' },
                },
                'flash-update': {
                    '0%': { color: 'var(--po-pink)', transform: 'scale(1.03)' },
                    '100%': { color: 'inherit', transform: 'scale(1)' },
                },
                'badge-pop': {
                    '0%': { transform: 'scale(0.8)' },
                    '60%': { transform: 'scale(1.15)' },
                    '100%': { transform: 'scale(1)' },
                },
                'glow-breathe': {
                    '0%, 100%': { boxShadow: '0 0 8px var(--po-gold-dim)' },
                    '50%': { boxShadow: '0 0 20px var(--po-gold-dim), 0 0 40px rgba(251,191,36,0.08)' },
                },
                'spin-slow': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'elimination-reveal': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '40%': { opacity: '1', transform: 'scale(1.02)', boxShadow: '0 0 30px rgba(239,68,68,0.4)' },
                    '100%': { transform: 'scale(1)', boxShadow: 'none' },
                },
                'count-pop': {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.4)' },
                    '100%': { transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
};
