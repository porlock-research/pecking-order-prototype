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
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('shell');
  if (fromUrl && SHELL_REGISTRY.some(s => s.id === fromUrl)) return fromUrl;

  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage && SHELL_REGISTRY.some(s => s.id === fromStorage)) return fromStorage;

  return 'immersive';
}

export function setActiveShellId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}
