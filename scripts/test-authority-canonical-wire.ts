import assert from 'node:assert/strict';
import {
  CANONICAL_JSON_WIRE_VERSION,
  canonicalSerialize,
  canonicalizeJsonValue,
} from '../packages/core/src';
import { InMemoryEventLog, logicalEventProjection } from '../packages/runtime/src';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const canonical = canonicalizeJsonValue({
    text: 'Cafe\u0301',
    optional: undefined,
    nested: { keep: 1, omit: undefined },
    minusZero: -0,
  }) as Record<string, unknown>;
  check(canonical.text === 'Café', 'wire strings normalize to NFC');
  check(!('optional' in canonical), 'undefined optional object property is omitted');
  check(!('omit' in canonical.nested as Record<string, unknown>), 'nested optional object property is omitted');
  check(canonical.minusZero === 0, 'wire format canonicalizes -0 to 0');
  canonicalSerialize(canonical);
  assertions += 1;

  assert.throws(() => canonicalizeJsonValue(undefined), /undefined outside/); assertions += 1;
  assert.throws(() => canonicalizeJsonValue([1, undefined]), /undefined outside/); assertions += 1;
  assert.throws(() => canonicalizeJsonValue(new Date()), /non-plain object/); assertions += 1;
  assert.throws(() => canonicalizeJsonValue({ 'Café': 1, 'Cafe\u0301': 2 }), /normalized-key collision/); assertions += 1;

  const sparse = new Array(2);
  sparse[1] = 'value';
  assert.throws(() => canonicalizeJsonValue(sparse), /sparse array hole/); assertions += 1;

  const log = new InMemoryEventLog();
  const accepted = await log.append({
    id: 'evt-wire-1' as never,
    type: 'wire.test',
    source: 'source' as never,
    payload: { status: 'ok', error: undefined },
    metadata: { optional: undefined } as never,
    severity: 'info',
    timestamp: '2026-08-28T10:00:00.000Z',
    traceId: 'trace-wire',
    spanId: 'span-wire',
    idempotencyKey: 'wire-key',
    correlationId: 'corr-wire',
    recordedAt: '2026-08-28T10:00:01.000Z',
  });
  const payload = accepted.event.payload as Record<string, unknown>;
  check(!('error' in payload), 'EventLog stores canonical wire payload rather than TS undefined');
  check(!('optional' in accepted.event.metadata), 'EventLog stores canonical wire metadata');
  check(
    logicalEventProjection(accepted.event).serializationVersion === CANONICAL_JSON_WIRE_VERSION,
    'logical-event equality is serialization-version bound',
  );

  await assert.rejects(() => log.append({
    id: 'evt-wire-2' as never,
    type: 'wire.test',
    source: 'source' as never,
    payload: [1, undefined],
    metadata: {},
    severity: 'info',
    timestamp: '2026-08-28T10:00:00.000Z',
    traceId: 'trace-wire-2',
    spanId: 'span-wire-2',
    idempotencyKey: 'wire-key-2',
    correlationId: 'corr-wire',
  }), /canonical JSON wire data/);
  assertions += 1;

  console.log(`Canonical JSON wire contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
