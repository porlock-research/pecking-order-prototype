import type { ShellManifest } from './types';
import { VIVID_CARTRIDGE_THEME } from '@pecking-order/ui-kit/cartridge-theme';

export const SHELL_REGISTRY: ShellManifest[] = [
  {
    id: 'classic',
    name: 'Classic',
    load: () => import('./classic/ClassicShell'),
    // uses DEFAULT_CARTRIDGE_THEME (dark)
  },
  {
    id: 'immersive',
    name: 'Immersive',
    load: () => import('./immersive/ImmersiveShell'),
    // uses DEFAULT_CARTRIDGE_THEME (dark)
  },
  {
    id: 'vivid',
    name: 'Vivid',
    load: () => import('./vivid/VividShell'),
    cartridgeTheme: VIVID_CARTRIDGE_THEME,
  },
];

const STORAGE_KEY = 'po_shell';

export function getActiveShellId(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'vivid';
}

export function setActiveShellId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}
