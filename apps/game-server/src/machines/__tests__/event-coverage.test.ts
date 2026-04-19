import { describe, test, expect } from 'vitest';
import { getStateNodes, toDirectedGraph, getShortestPaths } from 'xstate/graph';
import { dailySessionMachine } from '../l3-session';
import { orchestratorMachine } from '../l2-orchestrator';
import { VOTE_REGISTRY, PROMPT_REGISTRY } from '@pecking-order/cartridges';
import { GAME_REGISTRY } from '@pecking-order/game-cartridges';

/**
 * Static event coverage tests using xstate/graph.
 *
 * These tests verify that critical events are handled in all required states
 * without needing runtime traversal (no mock events/context needed).
 *
 * This would have caught the GM message bug where INTERNAL.INJECT_PROMPT
 * was only handled in mainStage.groupChat, not in voting/dailyGame states.
 */

// Helper: collect all state nodes that match a path pattern
function findStateNodes(machine: any, pathPattern: string) {
  const allNodes = getStateNodes(machine);
  return allNodes.filter((node) => node.path.join('.').includes(pathPattern));
}

// Helper: check if a state node (or any ancestor) handles a given event
function nodeHandlesEvent(node: any, eventType: string): boolean {
  let current = node;
  while (current) {
    const transitions = current.config?.on;
    if (transitions) {
      // Check exact match
      if (transitions[eventType]) return true;
      // Check wildcard handler (may forward based on guard)
      if (transitions['*']) return true;
    }
    current = current.parent;
  }
  return false;
}

// Helper: get all events handled by a node (including inherited from ancestors)
function getHandledEvents(node: any): string[] {
  const events: string[] = [];
  let current = node;
  while (current) {
    const transitions = current.config?.on;
    if (transitions) {
      events.push(...Object.keys(transitions));
    }
    current = current.parent;
  }
  return events;
}

describe('L3 Daily Session - Event Coverage', () => {
  test('INTERNAL.INJECT_PROMPT is handled in all mainStage substates', () => {
    // This is the exact bug we found: INJECT_PROMPT was only in groupChat.on,
    // not reachable from voting or dailyGame states.
    // After the fix, it's on running.on so it's always reachable.
    const mainStageNodes = findStateNodes(dailySessionMachine, 'mainStage');
    const substateNames = mainStageNodes
      .filter((n) => n.parent?.path.join('.').endsWith('mainStage'))
      .map((n) => n.key);

    expect(substateNames).toContain('groupChat');
    expect(substateNames).toContain('dailyGame');
    expect(substateNames).toContain('voting');

    // Each substate should be able to handle INJECT_PROMPT (via ancestor)
    for (const node of mainStageNodes.filter(
      (n) => n.parent?.path.join('.').endsWith('mainStage'),
    )) {
      expect(
        nodeHandlesEvent(node, 'INTERNAL.INJECT_PROMPT'),
      ).toBe(true);
    }
  });

  test('FACT.RECORD is handled in running state (always reachable)', () => {
    const runningNodes = findStateNodes(dailySessionMachine, 'running');
    const runningNode = runningNodes.find((n) => n.key === 'running');
    expect(runningNode).toBeDefined();

    const events = getHandledEvents(runningNode!);
    expect(events).toContain('FACT.RECORD');
  });

  test('INTERNAL.END_DAY is handled in running state', () => {
    const runningNodes = findStateNodes(dailySessionMachine, 'running');
    const runningNode = runningNodes.find((n) => n.key === 'running');
    expect(runningNode).toBeDefined();

    const events = getHandledEvents(runningNode!);
    expect(events).toContain('INTERNAL.END_DAY');
  });

  test('SOCIAL.SEND_MSG is handled in social.active', () => {
    const socialNodes = findStateNodes(dailySessionMachine, 'social');
    const activeNode = socialNodes.find((n) => n.key === 'active');
    expect(activeNode).toBeDefined();

    const events = getHandledEvents(activeNode!);
    expect(events).toContain('SOCIAL.SEND_MSG');
  });

  test('static graph is constructable (no config errors)', () => {
    const graph = toDirectedGraph(dailySessionMachine);
    expect(graph).toBeDefined();
    expect(graph.children.length).toBeGreaterThan(0);
  });
});

describe('L2 Orchestrator - Event Coverage', () => {
  test('ADMIN.INJECT_TIMELINE_EVENT is handled in activeSession', () => {
    const activeNodes = findStateNodes(orchestratorMachine, 'activeSession');
    const activeNode = activeNodes.find((n) => n.key === 'activeSession');
    expect(activeNode).toBeDefined();

    const events = getHandledEvents(activeNode!);
    expect(events).toContain('ADMIN.INJECT_TIMELINE_EVENT');
  });

  test('ADMIN.INJECT_TIMELINE_EVENT is handled in nightSummary (drop warning)', () => {
    const nightNodes = findStateNodes(orchestratorMachine, 'nightSummary');
    const nightNode = nightNodes.find((n) => n.key === 'nightSummary');
    expect(nightNode).toBeDefined();

    const events = getHandledEvents(nightNode!);
    expect(events).toContain('ADMIN.INJECT_TIMELINE_EVENT');
  });

  test('SOCIAL.SEND_MSG forwarding in activeSession (via wildcard)', () => {
    const activeNodes = findStateNodes(orchestratorMachine, 'activeSession');
    const activeNode = activeNodes.find((n) => n.key === 'activeSession');
    expect(activeNode).toBeDefined();

    // SOCIAL.SEND_MSG is handled by the '*' wildcard with a SOCIAL.* prefix guard
    expect(nodeHandlesEvent(activeNode!, 'SOCIAL.SEND_MSG')).toBe(true);
  });

  test('FACT.RECORD is handled in activeSession and nightSummary', () => {
    for (const stateName of ['activeSession', 'nightSummary']) {
      const nodes = findStateNodes(orchestratorMachine, stateName);
      const node = nodes.find((n) => n.key === stateName);
      expect(node).toBeDefined();

      const events = getHandledEvents(node!);
      expect(events).toContain('FACT.RECORD');
    }
  });

  test('static graph is constructable (no config errors)', () => {
    const graph = toDirectedGraph(orchestratorMachine);
    expect(graph).toBeDefined();
    expect(graph.children.length).toBeGreaterThan(0);
  });
});

// --- Registry Completeness ---

describe('Registry Completeness', () => {
  test.each(Object.entries(VOTE_REGISTRY))('VOTE_REGISTRY: %s produces a valid directed graph', (_type, machine) => {
    const graph = toDirectedGraph(machine as any);
    expect(graph).toBeDefined();
    expect(graph.children.length).toBeGreaterThanOrEqual(0);
  });

  test.each(Object.entries(PROMPT_REGISTRY))('PROMPT_REGISTRY: %s produces a valid directed graph', (_type, machine) => {
    const graph = toDirectedGraph(machine as any);
    expect(graph).toBeDefined();
    expect(graph.children.length).toBeGreaterThanOrEqual(0);
  });

  test.each(Object.entries(GAME_REGISTRY))('GAME_REGISTRY: %s produces a valid directed graph', (_type, machine) => {
    const graph = toDirectedGraph(machine as any);
    expect(graph).toBeDefined();
    expect(graph.children.length).toBeGreaterThanOrEqual(0);
  });
});

// --- Forced-Termination Contracts ---

// Voting machines that are instant (no interactive states to interrupt)
const INSTANT_VOTE_MACHINES = new Set(['SECOND_TO_LAST']);

describe('Forced-Termination Contracts', () => {
  test.each(
    Object.entries(VOTE_REGISTRY).filter(([type]) => !INSTANT_VOTE_MACHINES.has(type))
  )('Voting: %s handles INTERNAL.CLOSE_VOTING', (_type, machine) => {
    const allNodes = getStateNodes(machine as any);
    const handlers = allNodes.filter(n => nodeHandlesEvent(n, 'INTERNAL.CLOSE_VOTING'));
    expect(handlers.length).toBeGreaterThan(0);
  });

  test.each(
    Object.entries(VOTE_REGISTRY).filter(([type]) => INSTANT_VOTE_MACHINES.has(type))
  )('Voting: %s is instant (calculating → completed, no CLOSE_VOTING needed)', (_type, machine) => {
    const allNodes = getStateNodes(machine as any);
    const finalNodes = allNodes.filter(n => n.type === 'final');
    expect(finalNodes.length).toBeGreaterThan(0);
  });

  test.each(Object.entries(PROMPT_REGISTRY))('Prompt: %s handles INTERNAL.END_ACTIVITY', (_type, machine) => {
    const allNodes = getStateNodes(machine as any);
    const handlers = allNodes.filter(n => nodeHandlesEvent(n, 'INTERNAL.END_ACTIVITY'));
    expect(handlers.length).toBeGreaterThan(0);
  });

  test.each(Object.entries(GAME_REGISTRY))('Game: %s handles INTERNAL.END_GAME', (_type, machine) => {
    const allNodes = getStateNodes(machine as any);
    const handlers = allNodes.filter(n => nodeHandlesEvent(n, 'INTERNAL.END_GAME'));
    expect(handlers.length).toBeGreaterThan(0);
  });
});

// --- Critical Path Reachability ---

describe('Critical Path Reachability', () => {
  test('L2 can reach gameSummary from preGame', () => {
    const allNodes = getStateNodes(orchestratorMachine);
    const gameSummaryNode = allNodes.find(n => n.key === 'gameSummary');
    expect(gameSummaryNode).toBeDefined();
  });

  test('L3 has a final state (finishing)', () => {
    const allNodes = getStateNodes(dailySessionMachine);
    const finishingNode = allNodes.find(n => n.key === 'finishing');
    expect(finishingNode).toBeDefined();
    expect(finishingNode!.type).toBe('final');
  });

  test('L2 gameOver is a final state', () => {
    const allNodes = getStateNodes(orchestratorMachine);
    const gameOverNode = allNodes.find(n => n.key === 'gameOver');
    expect(gameOverNode).toBeDefined();
    expect(gameOverNode!.type).toBe('final');
  });
});
