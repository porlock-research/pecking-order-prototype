import { PULSE_Z } from '../zIndex';

/**
 * Layered ambient: subtle warm radial top (coral), purple bottom,
 * and a barely-there dot grid texture so the dark feels alive, not flat.
 */
export function AmbientBackground() {
  return (
    <>
      {/* Warm coral radial top */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
          pointerEvents: 'none',
          zIndex: PULSE_Z.base,
          background:
            'radial-gradient(ellipse 80% 80% at 50% -10%, color-mix(in oklch, var(--pulse-accent) 7%, transparent) 0%, transparent 50%)',
        }}
      />
      {/* Whisper purple radial bottom */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          pointerEvents: 'none',
          zIndex: PULSE_Z.base,
          background:
            'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(176,105,219,0.05) 0%, transparent 50%)',
        }}
      />
      {/* Diagonal noise — subtle striated texture, not a flat field */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: PULSE_Z.base,
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 1.5px),
            linear-gradient(135deg, transparent 49.5%, rgba(255,255,255,0.012) 50%, transparent 50.5%)
          `,
          backgroundSize: '32px 32px, 8px 8px',
        }}
      />
    </>
  );
}
