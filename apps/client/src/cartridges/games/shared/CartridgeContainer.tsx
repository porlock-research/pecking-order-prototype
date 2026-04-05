import type { ReactNode } from 'react';

interface CartridgeContainerProps {
  children: ReactNode;
}

export function CartridgeContainer({ children }: CartridgeContainerProps) {
  return (
    <div
      className="mx-4 my-2 rounded-xl bg-skin-cartridge text-white border border-white/[0.06] overflow-hidden slide-up-in shadow-card"
      style={{
        // Override skin text vars so child text-skin-* classes resolve to light
        // colors within this dark container context.
        '--po-text': '#ffffff',
        '--po-text-dim': 'rgba(255, 255, 255, 0.6)',
        '--po-text-inverted': '#3D2E1F',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
