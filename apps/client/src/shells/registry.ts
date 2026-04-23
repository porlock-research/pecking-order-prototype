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

export function getActiveShellId(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'pulse';
}

export function setActiveShellId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}
