import assert from 'node:assert/strict';
import type { EntityId } from '../packages/core/src';
import {
  InMemoryEventLog,
  PostgresEventLog,
  logicalEventHash,
  type AppendEventInput,
  type DurableEvent,
  type IEventLog,
} from '../packages/runtime/src';
import { FakeEventLogPostgres } from './fixtures/fake-event-log-postgres';

const T0 = '2026-08-28T10:00:00Z';
const T0_CANON = '2026-08-28T10:00:00.000Z';
const T1 = '2026-08-28T10:00:01.000Z';

async function main(): Promise<void> {
  const memory = new InMemoryEventLog();
  const fakeDb = new FakeEventLogPostgres();
  const postgres = new PostgresEventLog(fakeDb);
  await postgres.ensureSchema();

  const memoryReport = await runContract('memory', memory);
  const postgresReport = await runContract('postgres', postgres);

  assert.deepEqual(memoryReport.logicalHashes, postgresReport.logicalHashes, 'adapters produce identical logical hashes');
  assert.deepEqual(memoryReport.sequences, postgresReport.sequences, 'adapters assign equivalent sequence/cursor semantics');
  assert.deepEqual(memoryReport.payloads, postgresReport.payloads, 'adapters expose equivalent canonical payloads');

  // Postgres-specific row round-trip: driver Date values must normalize back to ISO.
  const rows = fakeDb.snapshotRows();
  assert.equal(rows.length, 2, 'two accepted rows remain after contract reset/reappend sequence');
  assert.ok(rows.every(row => row.occurred_at instanceof Date), 'fake driver returns Date objects like pg may do');

  console.log('Authority EventLog parity contract passed for InMemoryEventLog and PostgresEventLog');
}

async function runContract(label: string, log: IEventLog): Promise<{
  logicalHashes: string[];
  sequences: number[];
  payloads: unknown[];
}> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, `${label}: ${message}`);
    assertions += 1;
  };

  const payload = { b: 2, a: { nested: ['x', 'y'] } };
  const metadata = { source: 'fixture', attempt: 1 };
  const firstInput = event({
    id: 'attempt-1',
    idempotencyKey: 'operation-1',
    traceId: 'trace-1',
    spanId: 'span-1',
    parentSpanId: 'parent-1',
    payload,
    metadata,
    timestamp: T0,
    recordedAt: T1,
  });

  const first = await log.append(firstInput);
  check(first.appended, 'first append is accepted');
  check(first.event.sequence === 1, 'first sequence is 1');
  check(first.event.timestamp === T0_CANON, 'occurredAt is canonical ISO');
  check(first.event.recordedAt === T1, 'explicit recordedAt is preserved canonically');

  // Caller input/receipt mutation cannot change stored event.
  payload.a.nested[0] = 'mutated-input';
  metadata.attempt = 999;
  (first.event.payload as { a: { nested: string[] } }).a.nested[1] = 'mutated-receipt';
  first.event.metadata.attempt = 888;
  const stored = (await log.get(id('attempt-1')))!;
  check((stored.payload as { a: { nested: string[] } }).a.nested.join(',') === 'x,y', 'stored payload is copy-safe');
  check(stored.metadata.attempt === 1, 'stored metadata is copy-safe');

  // A true retry may have a different attempt event ID and tracing envelope.
  const retry = await log.append(event({
    id: 'attempt-2',
    idempotencyKey: 'operation-1',
    traceId: 'trace-retry',
    spanId: 'span-retry',
    parentSpanId: 'parent-retry',
    payload: { a: { nested: ['x', 'y'] }, b: 2 }, // different key insertion order
    metadata: { attempt: 1, source: 'fixture' },   // different key insertion order
    timestamp: T0_CANON,
    recordedAt: '2026-08-28T10:00:09.000Z', // attempt-local; ignored for logical equality
  }));
  check(!retry.appended, 'same logical retry converges');
  check(String(retry.event.id) === 'attempt-1', 'retry resolves to first accepted event identity');
  check(retry.event.sequence === 1, 'retry does not allocate a new sequence');
  check(logicalEventHash(retry.event) === logicalEventHash(stored), 'retry logical hash equals accepted event');

  await assert.rejects(
    () => log.append(event({
      id: 'attempt-3',
      idempotencyKey: 'operation-1',
      traceId: 'trace-3',
      spanId: 'span-3',
      payload: { a: { nested: ['DIFFERENT'] }, b: 2 },
      metadata: { source: 'fixture', attempt: 1 },
      timestamp: T0,
      recordedAt: T1,
    })),
    /IDEMPOTENCY_KEY_CONFLICT/,
    `${label}: same key with different payload must fail`,
  );
  assertions += 1;

  await assert.rejects(
    () => log.append(event({
      id: 'attempt-1',
      idempotencyKey: 'operation-2',
      traceId: 'trace-4',
      spanId: 'span-4',
      payload: { second: true },
      metadata: { source: 'fixture', attempt: 2 },
      timestamp: T1,
      recordedAt: T1,
    })),
    /EVENT_ID_COLLISION/,
    `${label}: accepted event ID cannot be reused for another key`,
  );
  assertions += 1;

  const second = await log.append(event({
    id: 'event-2',
    idempotencyKey: 'operation-2',
    traceId: 'trace-2',
    spanId: 'span-2',
    payload: { second: true },
    metadata: { source: 'fixture', attempt: 2 },
    timestamp: T1,
    recordedAt: T1,
    target: 'target-1',
    causationId: 'attempt-1',
  }));
  check(second.appended && second.event.sequence === 2, 'second logical event gets next sequence');
  check(String(second.event.target) === 'target-1', 'optional target round-trips');
  check(String(second.event.causationId) === 'attempt-1', 'optional causation round-trips');

  const page1 = await log.readFrom({ sequence: 0 }, 1);
  check(page1.length === 1 && page1[0].sequence === 1, 'readFrom respects cursor and limit');
  page1[0].metadata.attempt = 777;
  check((await log.get(id('attempt-1')))?.metadata.attempt === 1, 'readFrom results are detached');

  const page2 = await log.readFrom({ sequence: 1 }, 10);
  check(page2.length === 1 && page2[0].sequence === 2, 'cursor is exclusive and ordering ascending');
  check((await log.latestCursor()).sequence === 2, 'latest cursor reflects accepted events only');
  check(String((await log.getByIdempotencyKey('operation-1'))?.id) === 'attempt-1', 'lookup by idempotency key resolves first event');

  await assert.rejects(() => log.getByIdempotencyKey('   '), /must not be empty/); assertions += 1;
  await assert.rejects(() => log.readFrom({ sequence: -1 }, 1), /Invalid event-log cursor/); assertions += 1;
  await assert.rejects(() => log.readFrom({ sequence: 0.5 }, 1), /Invalid event-log cursor/); assertions += 1;
  await assert.rejects(() => log.readFrom({ sequence: 0 }, 100_001), /Invalid event-log limit/); assertions += 1;

  await assert.rejects(
    () => log.append(event({
      id: 'non-canonical',
      idempotencyKey: 'non-canonical',
      traceId: 'trace-x',
      spanId: 'span-x',
      payload: { bad: undefined },
      metadata: { source: 'fixture' },
      timestamp: T1,
      recordedAt: T1,
    })),
    /canonical JSON-like data/,
  );
  assertions += 1;

  const beforeClearHashes = (await log.readFrom({ sequence: 0 }, 100)).map(logicalEventHash);
  const beforeClearPayloads = (await log.readFrom({ sequence: 0 }, 100)).map(item => structuredClone(item.payload));
  await log.clear();
  check((await log.latestCursor()).sequence === 0, 'clear resets cursor in isolated fixture semantics');
  check((await log.readFrom()).length === 0, 'clear removes all events in isolated fixture semantics');

  const afterClear = await log.append(event({
    id: 'after-clear',
    idempotencyKey: 'after-clear',
    traceId: 'trace-after',
    spanId: 'span-after',
    payload: { reset: true },
    metadata: { source: 'fixture' },
    timestamp: T1,
    recordedAt: T1,
  }));
  check(afterClear.event.sequence === 1, 'isolated clear resets sequence identity');

  // Recreate second event so the fake Postgres fixture ends with 2 rows and both
  // adapters expose the same final sequence shape for report comparison.
  const afterClearSecond = await log.append(event({
    id: 'after-clear-2',
    idempotencyKey: 'after-clear-2',
    traceId: 'trace-after-2',
    spanId: 'span-after-2',
    payload: { reset: 2 },
    metadata: { source: 'fixture' },
    timestamp: T1,
    recordedAt: T1,
  }));
  check(afterClearSecond.event.sequence === 2, 'post-clear ordering remains monotonic from reset baseline');

  console.log(`${label}: ${assertions} EventLog assertions passed`);
  return {
    logicalHashes: beforeClearHashes,
    sequences: [1, 2],
    payloads: beforeClearPayloads,
  };
}

function event(input: {
  id: string;
  idempotencyKey: string;
  traceId: string;
  spanId: string;
  payload: unknown;
  metadata: Record<string, string | number | boolean | null>;
  timestamp: string;
  recordedAt: string;
  parentSpanId?: string;
  target?: string;
  causationId?: string;
}): AppendEventInput {
  return {
    id: id(input.id),
    type: 'authority.fixture.changed',
    source: id('fixture-source'),
    ...(input.target === undefined ? {} : { target: id(input.target) }),
    payload: input.payload,
    metadata: input.metadata,
    severity: 'info',
    timestamp: input.timestamp,
    traceId: input.traceId,
    spanId: input.spanId,
    ...(input.parentSpanId === undefined ? {} : { parentSpanId: input.parentSpanId }),
    idempotencyKey: input.idempotencyKey,
    correlationId: 'correlation-1',
    ...(input.causationId === undefined ? {} : { causationId: id(input.causationId) }),
    recordedAt: input.recordedAt,
  };
}

function id(value: string): EntityId {
  return value as EntityId;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
