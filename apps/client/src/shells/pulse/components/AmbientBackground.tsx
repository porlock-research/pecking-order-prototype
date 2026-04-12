/**
 * Layered ambient: subtle warm radial top (coral), purple bottom,
 * and a barely-there dot grid texture so the dark feels alive, not flat.
 */
export function AmbientBackground() {
  return (
    <>
      {/* Warm coral radial top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
          pointerEvents: 'none',
          zIndex: 0,
          background:
            'radial-gradient(ellipse 80% 80% at 50% -10%, rgba(255,59,111,0.07) 0%, transparent 50%)',
        }}
      />
      {/* Whisper purple radial bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          pointerEvents: 'none',
          zIndex: 0,
          background:
            'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(176,105,219,0.05) 0%, transparent 50%)',
        }}
      />
      {/* Subtle dot grid texture — gives the void some structure */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 0.6,
        }}
      />
    </>
  );
}
