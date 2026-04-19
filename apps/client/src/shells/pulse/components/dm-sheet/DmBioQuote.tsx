interface Props { bio: string | undefined; name: string; }

export function DmBioQuote({ bio, name }: Props) {
  if (!bio || !bio.trim() || bio.length <= 50) return null;
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--pulse-border)' }}>
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        <span style={{
          position: 'absolute', top: -10, left: -4,
          fontSize: 42, color: 'var(--pulse-accent)',
          fontFamily: 'var(--po-font-display)', fontWeight: 700,
          lineHeight: 1,
          opacity: 0.55,
        }}>&ldquo;</span>
        <div style={{
          fontStyle: 'italic', fontSize: 14, color: 'var(--pulse-text-1)', lineHeight: 1.4,
        }}>{bio}</div>
        <div style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: 1,
          color: 'var(--pulse-text-3)', marginTop: 6,
        }}>{name} · Pre-game interview</div>
      </div>
    </div>
  );
}
