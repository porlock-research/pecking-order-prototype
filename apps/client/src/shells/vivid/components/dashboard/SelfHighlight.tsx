import React from 'react';

export function SelfHighlight({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 10,
      padding: '8px 10px',
      borderRadius: 8,
      background: 'rgba(139, 108, 193, 0.06)',
      fontSize: 12,
      color: '#7A6B5A',
      lineHeight: 1.4,
    }}>
      {children}
    </div>
  );
}

export function SelfHighlightLabel({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: '#7B5DAF' }}>{children}</strong>;
}
