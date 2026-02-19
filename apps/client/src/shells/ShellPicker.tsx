import React from 'react';
import { SHELL_REGISTRY, getActiveShellId, setActiveShellId } from './registry';

export function ShellPicker() {


  const currentId = getActiveShellId();
  const current = SHELL_REGISTRY.find(s => s.id === currentId);

  const handleCycle = () => {
    const currentIndex = SHELL_REGISTRY.findIndex(s => s.id === currentId);
    const nextIndex = (currentIndex + 1) % SHELL_REGISTRY.length;
    const nextId = SHELL_REGISTRY[nextIndex].id;
    setActiveShellId(nextId);
    window.location.reload();
  };

  return (
    <button
      onClick={handleCycle}
      className="fixed bottom-2 left-2 z-[100] px-2.5 py-1 rounded-full bg-skin-panel/90 border border-white/[0.1] text-[10px] font-mono text-skin-dim hover:text-skin-gold hover:border-skin-gold/30 transition-all backdrop-blur-md shadow-card"
      title={`Current shell: ${current?.name}. Click to cycle.`}
    >
      {current?.name || currentId}
    </button>
  );
}
