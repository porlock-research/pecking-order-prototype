import { GameStatus } from "@pecking-order/shared-types";
import { log } from "@pecking-order/logger";

console.log("--- Simulator Starting ---");

// Test Shared Types Import
console.log(`Verifying Enums: GameStatus.OPEN = ${GameStatus.OPEN}`);

// Test Logger Import
// Passing null as ExecutionContext (mocking Cloudflare context)
log(null, "INFO", "Simulator test event", { layer: "LOBBY", test: true });

console.log("--- Simulator Complete ---");
