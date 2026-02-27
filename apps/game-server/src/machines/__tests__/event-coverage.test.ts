import { describe, test, expect } from 'vitest';
import { getStateNodes, toDirectedGraph } from '@xstate/graph';
import { dailySessionMachine } from '../l3-session';
import { orchestratorMachine } from '../l2-orchestrator';

/**
 * Static event coverage tests using @xstate/graph.
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

  test('SOCIAL.SEND_MSG forwarding in activeSession', () => {
    const activeNodes = findStateNodes(orchestratorMachine, 'activeSession');
    const activeNode = activeNodes.find((n) => n.key === 'activeSession');
    expect(activeNode).toBeDefined();

    const events = getHandledEvents(activeNode!);
    expect(events).toContain('SOCIAL.SEND_MSG');
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
