# GET /state Endpoint

## What it returns (L2 only)

- State value (e.g., `dayLoop`, `nightSummary`)
- Day index
- Manifest
- Roster

## What it does NOT return (L3)

- Channels
- Chat log
- Cartridge state
- Day phase
- Voting state
- Prompt state

## How to get L3 data

- **WebSocket SYNC**: Connect via PartySocket to `/parties/game-server/{gameId}`, receive SYNC message
- **INSPECT.SUBSCRIBE**: Send inspector subscription event via WebSocket
- **Code path**: `extractL3Context()` / `extractCartridges()` from `sync.ts`

## Common mistake

Agents repeatedly hit `/state` expecting full game state. It only has the orchestrator (L2) level. The daily session (L3) data — which includes everything players actually interact with — requires a WebSocket connection.
