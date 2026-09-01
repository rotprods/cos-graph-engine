import { createHash } from 'node:crypto';

export type FiscalAuthorityLevel =
  | 'OFFICIAL_AUTHORITY'
  | 'FILED_RETURN'
  | 'PRIMARY_FINANCIAL_STATEMENT'
  | 'PRIMARY_INVOICE_OR_CONTRACT'
  | 'OFFICIAL_CORRESPONDENCE'
  | 'RECONSTRUCTED_LEDGER'
  | 'DERIVED_SUMMARY'
  | 'USER_REPORTED'
  | 'HYPOTHESIS';

export type FiscalCertainty =
  | 'CONFIRMED'
  | 'RECONSTRUCTED'
  | 'PRELIMINARY'
  | 'REVIEW'
  | 'SCENARIO'
  | 'BLOCKED';

export type FiscalAggregateType =
  | 'evidence'
  | 'claim'
  | 'fact'
  | 'invoice'
  | 'payment'
  | 'tax_obligation'
  | 'tax_return'
  | 'tax_lot'
  | 'asset'
  | 'account'
  | 'counterparty'
  | 'task'
  | 'decision'
  | 'risk'
  | 'incident'
  | 'agent'
  | 'tool'
  | 'workflow';

export type FiscalEventType =
  | 'EVIDENCE_OBSERVED'
  | 'EVIDENCE_PARSED'
  | 'ENTITY_RESOLVED'
  | 'CLAIM_PROPOSED'
  | 'CLAIM_VALIDATED'
  | 'FACT_PROMOTED'
  | 'FACT_REJECTED'
  | 'STATE_TRANSITIONED'
  | 'CALCULATION_RECOMPUTED'
  | 'TASK_CREATED'
  | 'TASK_BLOCKED'
  | 'TASK_UNBLOCKED'
  | 'TASK_COMPLETED'
  | 'DECISION_RECORDED'
  | 'RISK_OPENED'
  | 'RISK_CLOSED'
  | 'TOOL_CALLED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'CHECKPOINT_CREATED';

export interface FiscalEventSource {
  authority: FiscalAuthorityLevel;
  sourceId: string;
  uri?: string;
  contentHash?: string;
}

export interface FiscalTemporalContext {
  /** Time of the real-world event when known. */
  eventTime: string;
  /** Time the system learned/observed it. */
  observedAt: string;
  validFrom?: string;
  validTo?: string;
  filedAt?: string;
  paidAt?: string;
  supersededAt?: string;
}

export interface FiscalEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  aggregateType: FiscalAggregateType;
  aggregateId: string;
  type: FiscalEventType;
  sequence: number;
  temporal: FiscalTemporalContext;
  source: FiscalEventSource;
  certainty: FiscalCertainty;
  evidenceIds: string[];
  payload: TPayload;
  previousEventHash?: string;
  hash: string;
}

export interface AppendFiscalEventInput<TPayload = Record<string, unknown>> {
  eventId?: string;
  aggregateType: FiscalAggregateType;
  aggregateId: string;
  type: FiscalEventType;
  temporal: FiscalTemporalContext;
  source: FiscalEventSource;
  certainty: FiscalCertainty;
  evidenceIds?: string[];
  payload: TPayload;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Minimal append-only event store for the fiscal/financial COS profile.
 * Production persistence adapters can replay exactly the same event envelope.
 */
export class FiscalEventStore {
  private readonly events: FiscalEvent[] = [];

  append<TPayload>(input: AppendFiscalEventInput<TPayload>): FiscalEvent<TPayload> {
    const previous = this.events[this.events.length - 1];
    const sequence = previous ? previous.sequence + 1 : 1;
    const eventId = input.eventId ?? `fiscal-event-${sequence}`;
    if (this.events.some(e => e.eventId === eventId)) {
      throw new Error(`Duplicate fiscal event ID: ${eventId}`);
    }

    const unsigned = {
      eventId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      type: input.type,
      sequence,
      temporal: input.temporal,
      source: input.source,
      certainty: input.certainty,
      evidenceIds: input.evidenceIds ?? [],
      payload: input.payload,
      previousEventHash: previous?.hash,
    };

    const event = { ...unsigned, hash: sha256(unsigned) } as FiscalEvent<TPayload>;
    this.events.push(event as FiscalEvent);
    return event;
  }

  all(): FiscalEvent[] {
    return this.events.map(e => structuredClone(e));
  }

  byAggregate(aggregateType: FiscalAggregateType, aggregateId: string): FiscalEvent[] {
    return this.events
      .filter(e => e.aggregateType === aggregateType && e.aggregateId === aggregateId)
      .map(e => structuredClone(e));
  }

  verifyChain(): string[] {
    const errors: string[] = [];
    let previousHash: string | undefined;
    let expectedSequence = 1;

    for (const event of this.events) {
      if (event.sequence !== expectedSequence) {
        errors.push(`Sequence mismatch at ${event.eventId}: expected ${expectedSequence}, got ${event.sequence}`);
      }
      if (event.previousEventHash !== previousHash) {
        errors.push(`Previous hash mismatch at ${event.eventId}`);
      }
      const { hash, ...unsigned } = event;
      const expectedHash = sha256(unsigned);
      if (hash !== expectedHash) errors.push(`Hash mismatch at ${event.eventId}`);
      previousHash = event.hash;
      expectedSequence++;
    }

    return errors;
  }

  checkpointHash(): string {
    return sha256(this.events.map(e => e.hash));
  }

  toJSON(): FiscalEvent[] {
    return this.all();
  }

  static fromJSON(events: FiscalEvent[]): FiscalEventStore {
    const store = new FiscalEventStore();
    (store.events as FiscalEvent[]).push(...events.map(e => structuredClone(e)));
    const errors = store.verifyChain();
    if (errors.length) throw new Error(`Invalid fiscal event chain: ${errors.join('; ')}`);
    return store;
  }
}

export interface CanonicalIdentity {
  canonicalId: string;
  namespace: string;
  entityType: string;
  aliases: string[];
  sourceIds: string[];
  createdAt: string;
}

/**
 * Stable identity layer. A source filename, email address or display label is an alias,
 * never the canonical identity by itself.
 */
export class FiscalIdentityRegistry {
  private readonly identities = new Map<string, CanonicalIdentity>();
  private readonly aliasToId = new Map<string, string>();

  register(identity: CanonicalIdentity): void {
    if (this.identities.has(identity.canonicalId)) {
      throw new Error(`Canonical identity already exists: ${identity.canonicalId}`);
    }
    for (const alias of identity.aliases) {
      const key = this.aliasKey(identity.namespace, alias);
      const existing = this.aliasToId.get(key);
      if (existing && existing !== identity.canonicalId) {
        throw new Error(`Alias collision in ${identity.namespace}: ${alias}`);
      }
    }
    this.identities.set(identity.canonicalId, structuredClone(identity));
    for (const alias of identity.aliases) {
      this.aliasToId.set(this.aliasKey(identity.namespace, alias), identity.canonicalId);
    }
  }

  resolve(namespace: string, alias: string): CanonicalIdentity | undefined {
    const id = this.aliasToId.get(this.aliasKey(namespace, alias));
    return id ? structuredClone(this.identities.get(id)!) : undefined;
  }

  get(canonicalId: string): CanonicalIdentity | undefined {
    const identity = this.identities.get(canonicalId);
    return identity ? structuredClone(identity) : undefined;
  }

  private aliasKey(namespace: string, alias: string): string {
    return `${namespace.trim().toLowerCase()}::${alias.trim().toLowerCase()}`;
  }
}
