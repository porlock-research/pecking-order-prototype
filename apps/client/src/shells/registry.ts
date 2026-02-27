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
];

const STORAGE_KEY = 'po_shell';

export function getActiveShellId(): string {
  return 'immersive';
}

export function setActiveShellId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}
