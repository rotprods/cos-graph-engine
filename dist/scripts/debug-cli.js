"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("../packages/graph/src/cli");
async function main() {
    const logs = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push('[ERR] ' + args.join(' '));
    await (0, cli_1.graphCli)(['info', '--level', 'L4']);
    console.log = origLog;
    console.error = origErr;
    console.log('=== OUTPUT ===');
    logs.forEach(l => console.log(l));
}
main().catch(e => console.error('Fatal:', e.message));
//# sourceMappingURL=debug-cli.js.map