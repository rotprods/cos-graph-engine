import { graphCli } from '../packages/graph/src/cli';

async function main() {
  const logs: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: any[]) => logs.push(args.join(' '));
  console.error = (...args: any[]) => logs.push('[ERR] ' + args.join(' '));
  
  await graphCli(['info', '--level', 'L4']);
  
  console.log = origLog;
  console.error = origErr;
  
  console.log('=== OUTPUT ===');
  logs.forEach(l => console.log(l));
}

main().catch(e => console.error('Fatal:', e.message));