import React from 'react';
import './vivid.css';
import type { ShellProps } from '../types';

function VividShell({ playerId, engine, token }: ShellProps) {
  return (
    <div className="vivid-shell fixed inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center">
        <span className="text-2xl" style={{ fontFamily: 'var(--vivid-font-display)', color: 'var(--vivid-coral)' }}>
          Vivid Shell
        </span>
      </div>
    </div>
  );
}

export default VividShell;
