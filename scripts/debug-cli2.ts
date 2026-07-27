import { graphCli } from '../packages/graph/src/cli';

async function main() {
  // Test directly without capture
  console.log('BEFORE CALL');
  await graphCli(['info', '--level', 'L4']);
  console.log('AFTER CALL');
}

main().catch(e => console.error('Fatal:', e.message));