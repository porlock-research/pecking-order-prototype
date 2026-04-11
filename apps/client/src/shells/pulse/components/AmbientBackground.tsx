export function AmbientBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        background:
          'radial-gradient(ellipse at center, rgba(255,59,111,0.015) 0%, transparent 70%)',
      }}
    />
  );
}
