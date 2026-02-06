# Pecking Order (Prototype)

A 7-day persistent social deduction game engine built on the "Russian Doll" architecture.

## 🏗 Architecture

*   **Apps:**
    *   `apps/lobby` (P1): Next.js Web App for hosting games and persona generation.
    *   `apps/game-server` (L1/L2/L3): PartyKit Server (Durable Objects) handling the game loop.
    *   `apps/client` (L0): React PWA Shell for players.
*   **Packages:**
    *   `packages/shared-types`: Source of Truth for schemas and interfaces.
    *   `packages/logger`: Structured logging (Axiom + Console).

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   npm 10+

### Installation
```bash
npm install
```

### Running the Stack (Dev Mode)

You can run individual apps or the whole stack (via Turbo).

**1. Start the Game Server (Port 1999)**
```bash
npx turbo dev --filter=game-server
```

**2. Start the Lobby (Port 3000)**
```bash
npx turbo dev --filter=lobby-service
```

**3. Start the Client (Port 5173)**
```bash
npx turbo dev --filter=client
```

**4. Run All**
```bash
npm run dev
```

### Building
```bash
npm run build
```

## 🛠 Project Status
See `plans/00_master_plan.md` for the current implementation roadmap.

## 📜 Documentation
*   `plans/`: Implementation Plans & Decisions.
*   `spec/`: Original Technical Specifications.
