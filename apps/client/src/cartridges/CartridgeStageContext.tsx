import { createContext, useContext } from 'react';

/**
 * Signals to cartridges that they're being rendered inside a "stage"
 * host (currently: the Pulse cartridge overlay) so they can suppress
 * inline chrome that the stage renders externally — most notably the
 * HOW IT WORKS panel, which gets promoted to a distinct card above
 * the cartridge when staged.
 */
export interface CartridgeStage {
  /** True when the cartridge is mounted inside the Pulse overlay stage. */
  staged: boolean;
}

export const CartridgeStageContext = createContext<CartridgeStage>({ staged: false });

export const useCartridgeStage = () => useContext(CartridgeStageContext);
