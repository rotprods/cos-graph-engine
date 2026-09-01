import type { EntityId } from '@cos/core';
import {
  ExecutionGraphEngine,
  type ExecEdge,
  type ExecNode,
} from '../level1-execution';
import {
  StateMachine,
  type StateConfig,
  type StateTransition,
} from '../level2-state';
import {
  DependencyResolver,
  type DepEdge,
  type DepNode,
} from '../level3-dependency';
import type { FiscalAuthorityLevel } from './fiscal-events';

export type FiscalPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type FiscalRecoveryTaskStatus =
  | 'OPEN'
  | 'READY'
  | 'ACTIVE'
  | 'QUEUED'
  | 'BLOCKED'
  | 'BLOCKED_EXTERNAL'
  | 'EVIDENCE_FOUND'
  | 'DONE'
  | 'CLOSED';

export interface FiscalRecoveryTaskInput {
  id: string;
  name: string;
  status: FiscalRecoveryTaskStatus;
  priority: FiscalPriority;
  blockedBy: string[];
  evidenceIds: string[];
  owner?: string;
  deadline?: string;
  definitionOfDone?: string;
  metadata?: Record<string, unknown>;
}

export interface FiscalRecoveryProjection {
  execution: {
    engine: ExecutionGraphEngine;
    graphId: EntityId;
    nodes: ExecNode[];
    edges: ExecEdge[];
  };
  dependency: {
    resolver: DependencyResolver;
    graphId: EntityId;
    nodes: DepNode[];
    edges: DepEdge[];
    order: EntityId[];
  };
}

function assertUniqueTaskIds(tasks: readonly FiscalRecoveryTaskInput[]): void {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) throw new Error(`Duplicate fiscal recovery task ID: ${task.id}`);
    ids.add(task.id);
  }
}

function assertKnownDependencies(tasks: readonly FiscalRecoveryTaskInput[]): void {
  const ids = new Set(tasks.map(t => t.id));
  for (const task of tasks) {
    for (const blocker of task.blockedBy) {
      if (!ids.has(blocker)) {
        throw new Error(`Task ${task.id} depends on unknown task ${blocker}`);
      }
    }
  }
}

/**
 * Compiles a durable recovery backlog into COS L1 ExecutionGraph and L3 DependencyGraph.
 *
 * Edge semantics intentionally differ by kernel level:
 * - L1: blocker -> task (execution flows after blocker completes)
 * - L3: task -> blocker (source depends_on target, per DependencyGraph convention)
 */
export async function projectFiscalRecoveryTasks(
  tasks: readonly FiscalRecoveryTaskInput[],
  name = 'Fiscal Recovery',
): Promise<FiscalRecoveryProjection> {
  assertUniqueTaskIds(tasks);
  assertKnownDependencies(tasks);

  const execNodes: ExecNode[] = tasks.map(task => ({
    id: task.id as EntityId,
    name: task.name,
    type: 'transform',
    config: {
      fiscalTask: true,
      status: task.status,
      priority: task.priority,
      evidenceIds: [...task.evidenceIds],
      owner: task.owner,
      deadline: task.deadline,
      definitionOfDone: task.definitionOfDone,
      ...task.metadata,
    },
  }));

  const execEdges: ExecEdge[] = [];
  let edgeSeq = 0;
  for (const task of tasks) {
    for (const blocker of task.blockedBy) {
      execEdges.push({
        id: `fiscal-exec-edge-${++edgeSeq}` as EntityId,
        source: blocker as EntityId,
        target: task.id as EntityId,
      });
    }
  }

  const executionEngine = new ExecutionGraphEngine();
  const executionGraphId = await executionEngine.createGraph(
    `${name} — L1`,
    execNodes,
    execEdges,
    { maxConcurrency: 4 },
  );

  const depNodes: DepNode[] = tasks.map(task => ({
    id: task.id as EntityId,
    name: task.name,
    type: 'module',
    metadata: {
      fiscalTask: true,
      status: task.status,
      priority: task.priority,
      evidenceIds: [...task.evidenceIds],
      owner: task.owner,
      deadline: task.deadline,
      definitionOfDone: task.definitionOfDone,
      ...task.metadata,
    },
  }));

  const depEdges: DepEdge[] = [];
  for (const task of tasks) {
    for (const blocker of task.blockedBy) {
      depEdges.push({
        source: task.id as EntityId,
        target: blocker as EntityId,
        type: 'depends_on',
      });
    }
  }

  const dependencyResolver = new DependencyResolver();
  const dependencyGraphId = dependencyResolver.createGraph(`${name} — L3`, depNodes, depEdges);
  const cycle = dependencyResolver.detectCycle(dependencyGraphId);
  if (cycle) throw new Error(`Fiscal recovery dependency cycle: ${cycle.join(' -> ')}`);

  return {
    execution: {
      engine: executionEngine,
      graphId: executionGraphId,
      nodes: execNodes,
      edges: execEdges,
    },
    dependency: {
      resolver: dependencyResolver,
      graphId: dependencyGraphId,
      nodes: depNodes,
      edges: depEdges,
      order: dependencyResolver.topologicalSort(dependencyGraphId),
    },
  };
}

export type FiscalLifecycleKind = 'evidence' | 'filing' | 'payment' | 'invoice';

export interface FiscalTransitionProof {
  evidenceId?: string;
  authority?: FiscalAuthorityLevel;
  filingReceipt?: boolean;
  paymentProof?: boolean;
  rectificationEvidence?: boolean;
}

function evidenceMachine(): StateMachine {
  const states: StateConfig[] = [
    { id: 'DISCOVERED', label: 'Discovered', type: 'initial' },
    { id: 'INGESTED', label: 'Ingested' },
    { id: 'PARSED', label: 'Parsed' },
    { id: 'NORMALIZED', label: 'Normalized' },
    { id: 'VALIDATED', label: 'Validated' },
    { id: 'AUTHORITATIVE', label: 'Authoritative', type: 'final' },
    { id: 'REJECTED', label: 'Rejected', type: 'final' },
  ];
  const transitions: StateTransition[] = [
    { from: 'DISCOVERED', to: 'INGESTED', event: 'ingest' },
    { from: 'INGESTED', to: 'PARSED', event: 'parse' },
    { from: 'PARSED', to: 'NORMALIZED', event: 'normalize' },
    { from: 'NORMALIZED', to: 'VALIDATED', event: 'validate' },
    { from: 'VALIDATED', to: 'AUTHORITATIVE', event: 'promote_authoritative' },
    { from: 'VALIDATED', to: 'REJECTED', event: 'reject' },
  ];
  return new StateMachine('Fiscal Evidence Lifecycle', states, transitions, 'DISCOVERED');
}

function filingMachine(): StateMachine {
  const states: StateConfig[] = [
    { id: 'UNKNOWN', label: 'Unknown', type: 'initial' },
    { id: 'PREPARED', label: 'Prepared' },
    { id: 'FILED', label: 'Filed' },
    { id: 'LIQUIDATED', label: 'Liquidated' },
    { id: 'PAID', label: 'Paid', type: 'final' },
    { id: 'CLOSED', label: 'Closed', type: 'final' },
    { id: 'NOT_FILED', label: 'Not Filed' },
    { id: 'REGULARIZATION_REQUIRED', label: 'Regularization Required' },
  ];
  const transitions: StateTransition[] = [
    { from: 'UNKNOWN', to: 'PREPARED', event: 'mark_prepared' },
    { from: 'UNKNOWN', to: 'FILED', event: 'mark_filed' },
    { from: 'PREPARED', to: 'FILED', event: 'mark_filed' },
    { from: 'FILED', to: 'LIQUIDATED', event: 'mark_liquidated' },
    { from: 'FILED', to: 'CLOSED', event: 'close_no_payment_due' },
    { from: 'LIQUIDATED', to: 'PAID', event: 'mark_paid' },
    { from: 'UNKNOWN', to: 'NOT_FILED', event: 'confirm_not_filed' },
    { from: 'PREPARED', to: 'NOT_FILED', event: 'confirm_not_filed' },
    { from: 'NOT_FILED', to: 'REGULARIZATION_REQUIRED', event: 'require_regularization' },
    { from: 'REGULARIZATION_REQUIRED', to: 'FILED', event: 'mark_filed' },
  ];
  return new StateMachine('Fiscal Filing Lifecycle', states, transitions, 'UNKNOWN');
}

function paymentMachine(): StateMachine {
  const states: StateConfig[] = [
    { id: 'UNKNOWN', label: 'Unknown', type: 'initial' },
    { id: 'DUE', label: 'Due' },
    { id: 'PAYMENT_INSTRUCTED', label: 'Payment Instructed' },
    { id: 'PAID', label: 'Paid', type: 'final' },
    { id: 'FAILED', label: 'Failed', type: 'error' },
    { id: 'DEFERRED', label: 'Deferred' },
  ];
  const transitions: StateTransition[] = [
    { from: 'UNKNOWN', to: 'DUE', event: 'confirm_due' },
    { from: 'DUE', to: 'PAYMENT_INSTRUCTED', event: 'instruct_payment' },
    { from: 'PAYMENT_INSTRUCTED', to: 'PAID', event: 'mark_paid' },
    { from: 'PAYMENT_INSTRUCTED', to: 'FAILED', event: 'payment_failed' },
    { from: 'DUE', to: 'DEFERRED', event: 'defer' },
    { from: 'DEFERRED', to: 'PAID', event: 'mark_paid' },
  ];
  return new StateMachine('Fiscal Payment Lifecycle', states, transitions, 'UNKNOWN');
}

function invoiceMachine(): StateMachine {
  const states: StateConfig[] = [
    { id: 'DRAFT', label: 'Draft', type: 'initial' },
    { id: 'ISSUED', label: 'Issued' },
    { id: 'COLLECTED', label: 'Collected', type: 'final' },
    { id: 'RECTIFIED', label: 'Rectified', type: 'final' },
    { id: 'ANNULLED', label: 'Annulled', type: 'final' },
  ];
  const transitions: StateTransition[] = [
    { from: 'DRAFT', to: 'ISSUED', event: 'issue' },
    { from: 'ISSUED', to: 'COLLECTED', event: 'collect' },
    { from: 'ISSUED', to: 'RECTIFIED', event: 'rectify' },
    { from: 'ISSUED', to: 'ANNULLED', event: 'annul' },
  ];
  return new StateMachine('Fiscal Invoice Lifecycle', states, transitions, 'DRAFT');
}

export function createFiscalLifecycle(kind: FiscalLifecycleKind): StateMachine {
  if (kind === 'evidence') return evidenceMachine();
  if (kind === 'filing') return filingMachine();
  if (kind === 'payment') return paymentMachine();
  return invoiceMachine();
}

function isOfficial(authority?: FiscalAuthorityLevel): boolean {
  return authority === 'OFFICIAL_AUTHORITY' || authority === 'FILED_RETURN';
}

/**
 * Policy gate around L2 state machines. The generic StateMachine remains domain-neutral;
 * fiscal promotion rules live here.
 */
export async function sendFiscalTransition(
  kind: FiscalLifecycleKind,
  machine: StateMachine,
  event: string,
  proof: FiscalTransitionProof = {},
): Promise<boolean> {
  if (kind === 'filing' && event === 'mark_filed') {
    if (!proof.evidenceId || !proof.filingReceipt || !isOfficial(proof.authority)) {
      return false;
    }
  }

  if (kind === 'filing' && event === 'confirm_not_filed') {
    if (!proof.evidenceId || proof.authority !== 'OFFICIAL_AUTHORITY') return false;
  }

  if ((kind === 'filing' || kind === 'payment') && event === 'mark_paid') {
    if (!proof.evidenceId || !proof.paymentProof) return false;
    if (proof.authority !== 'OFFICIAL_AUTHORITY' && proof.authority !== 'PRIMARY_FINANCIAL_STATEMENT') {
      return false;
    }
  }

  if (kind === 'invoice' && (event === 'rectify' || event === 'annul')) {
    if (!proof.evidenceId || !proof.rectificationEvidence) return false;
  }

  if (kind === 'evidence' && event === 'promote_authoritative') {
    if (!proof.evidenceId || !proof.authority) return false;
  }

  return machine.send(event);
}
