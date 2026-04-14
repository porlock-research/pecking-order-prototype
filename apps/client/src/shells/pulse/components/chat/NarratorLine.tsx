interface Props {
  kind: 'talking' | 'scheming' | 'alliance';
  text: string;
}

export function NarratorLine({ kind, text }: Props) {
  const color =
    kind === 'scheming' ? '#b07aff' :
    kind === 'alliance' ? '#ffd700' :
    'var(--pulse-accent)';
  return (
    <div style={{
      textAlign: 'center', padding: '10px 16px',
      fontStyle: 'italic', fontSize: 11, color,
      letterSpacing: 0.2, opacity: 0.85,
    }}>{text}</div>
  );
}
