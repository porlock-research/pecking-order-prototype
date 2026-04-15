/**
 * Pulse-local storage for the pill-origin rect used by the cartridge overlay's
 * scale-from-origin entry animation. Intentionally NOT in Zustand — coordinates
 * are pure presentation and the store is shell-agnostic.
 *
 * Usage:
 *   const { set, consume } = usePillOrigin();
 *   // In Pill.onClick: set(rect); then dispatch focusCartridge.
 *   // In CartridgeOverlay on mount: const rect = consume();
 *   // consume() returns the rect and clears it — one-shot per open.
 */
let storedRect: DOMRect | null = null;

export function usePillOrigin() {
  return {
    set(rect: DOMRect | null) {
      storedRect = rect;
    },
    consume(): DOMRect | null {
      const r = storedRect;
      storedRect = null;
      return r;
    },
    peek(): DOMRect | null {
      return storedRect;
    },
  };
}
