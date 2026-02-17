import type { ReactNode } from 'react';

interface CartridgeContainerProps {
  children: ReactNode;
}

export function CartridgeContainer({ children }: CartridgeContainerProps) {
  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">
      {children}
    </div>
  );
}
