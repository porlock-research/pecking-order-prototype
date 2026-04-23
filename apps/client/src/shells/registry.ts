import type { ShellManifest } from './types';

export const SHELL_REGISTRY: ShellManifest[] = [
  {
    id: 'classic',
    name: 'Classic',
    load: () => import('./classic/ClassicShell'),
  },
  {
    id: 'immersive',
    name: 'Immersive',
    load: () => import('./immersive/ImmersiveShell'),
  },
  {
    id: 'vivid',
    name: 'Vivid',
    load: () => import('./vivid/VividShell'),
  },
  {
    id: 'pulse',
    name: 'Pulse',
    load: () => import('./pulse/PulseShell'),
  },
];

const STORAGE_KEY = 'po_shell';

// Pulse is the only actively-supported shell — force it for everyone,
// ignoring any stale po_shell preference. ShellPicker writes still go to
// localStorage so a later relax-back to read-from-storage is one-line, but
// for now the read always returns 'pulse'.
export function getActiveShellId(): string {
  return 'pulse';
}

export function setActiveShellId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}
