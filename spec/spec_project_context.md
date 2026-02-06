# **Project Context: Pecking Order Game Engine**

**Status:** Ready for Implementation

**Target Stack:** Cloudflare Ecosystem (Workers, Pages, D1, Durable Objects) \+ PartyKit \+ XState v5 \+ React PWA.

## **1\. What are we building?**

**Pecking Order** is a high-stakes social deduction game played over **7 real-time days**.

* **The Vibe:** Survivor meets Among Us via Text Message.  
* **The Loop:** 8 players enter. Every morning (9 AM), a new daily schedule begins. Every night (Midnight), someone is eliminated.  
* **The Goal:** Survive to Day 7 and win the "Gold" (Lifetime Score).

## **2\. Why is this hard? (Architectural Drivers)**

Unlike a standard 10-minute .io game, this system must survive for **168 hours**.

1. **Durability:** The server must "sleep" to save money but wake up exactly at 9 AM without losing state.  
2. **Concurrency:** Players must be able to Chat (Social) *while* playing Minigames (Main Stage) simultaneously.  
3. **Destiny:** We must track complex historical data (e.g., "Did Player A ever hit 0 silver?") across the entire week to award hidden victory conditions.

## **3\. The Solution Architecture**

We have designed a "Russian Doll" architecture to isolate these concerns:

* **P1 (Lobby App):** A standard web app for waiting, invites, and AI persona generation.  
* **L1 (Infrastructure):** A PartyKit Durable Object that acts as the "Hardware." It handles persistence and sockets.  
* **L2 (Orchestrator):** An XState machine that manages the 7-Day Lifecycle.  
* **L3 (Daily Session):** An XState machine that manages the 24-Hour Gameplay Loop using Parallel States.

## **4\. Instructions for the Implementation Agent**

You are tasked with building this system. Please follow this sequence:

1. **Review the Specs:**  
   * Read spec/master\_technical\_spec.md for the full stack overview and data schemas.  
   * Read spec/machine\_architecture.md for the exact XState code structures.  
2. **Phase 1: The Lobby (P1):**  
   * Build the Next.js/Remix app on Cloudflare Pages.  
   * Implement Google Gemini for generating personas.  
   * Create the "Handoff" mechanism that POSTs the final roster to PartyKit.  
3. **Phase 2: The Engine (L1/L2/L3):**  
   * Initialize the PartyKit server.  
   * Implement the L2 Orchestrator to handle the 7-day loop and Journaling.  
   * Implement the L3 Daily Session with Parallel Regions (Social/Main/Activity).  
4. **Phase 3: The Client (L0):**  
   * Build the React PWA Shell.  
   * Implement the "Sync-on-Connect" WebSocket pattern.  
   * Create the Lazy Loader for game cartridges.

**Critical Rule:** Do not deviate from the **Event Namespacing Protocol** (GAME.\*, SOCIAL.\*, FACT.\*). This naming convention is the glue holding the layers together.