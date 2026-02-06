import type { PartyKitServer } from "partykit/server";
import { Roster, GameStatus } from "@pecking-order/shared-types";
import { log } from "@pecking-order/logger";

export default {
  onConnect(ws, room) {
    log(null, "INFO", "Client connected to Game Server", { layer: "L1", roomId: room.id });
    
    const mockRoster: Roster = {}; // Verify Type Import
    console.log(`Server Ready. Status: ${GameStatus.OPEN}`);
  }
} satisfies PartyKitServer;
