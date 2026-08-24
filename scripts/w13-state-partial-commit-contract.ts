import { mkdirSync, writeFileSync } from 'node:fs';
import {
  PartialStateTransitionError,
  VersionedStateMachine,
} from '../packages/graph/src';

async function main(): Promise<void> {
  const machine = new VersionedStateMachine(
    'partial-transition-fixture',
    [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
    [{
      from: 'A',
      to: 'B',
      event: 'advance',
      action: async () => {
        throw new Error('simulated callback failure after state mutation');
      },
    }],
    'A',
  );

  let observed: unknown;
  try {
    await machine.send('advance', undefined, { expectedState: 'A', expectedRevision: 0 });
  } catch (error) {
    observed = error;
  }

  if (!(observed instanceof PartialStateTransitionError)) {
    throw new Error('partial transition did not produce PartialStateTransitionError');
  }
  if (machine.state !== 'B') throw new Error(`expected mutated state B, received ${machine.state}`);
  if (machine.currentRevision !== 1) {
    throw new Error(`partial commit did not advance fencing revision: ${machine.currentRevision}`);
  }
  const failures = machine.getFailureLog();
  if (failures.length !== 1 || !failures[0].partialCommit) {
    throw new Error('partial transition was not retained as explicit failure evidence');
  }

  let staleRejected = false;
  try {
    await machine.send('advance', undefined, { expectedState: 'A', expectedRevision: 0 });
  } catch (error) {
    staleRejected = error instanceof Error && error.message.includes('STALE_STATE');
  }
  if (!staleRejected) throw new Error('stale writer was not rejected after partial commit');

  mkdirSync('artifacts/w13', { recursive: true });
  writeFileSync('artifacts/w13/state-partial-commit-contract.json', JSON.stringify({
    passed: true,
    state: machine.state,
    revision: machine.currentRevision,
    failure: failures[0],
  }, null, 2));
  console.log('PASS partial transition commit is fenced and observable');
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
