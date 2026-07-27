"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("../packages/graph/src/cli");
async function main() {
    // Test directly without capture
    console.log('BEFORE CALL');
    await (0, cli_1.graphCli)(['info', '--level', 'L4']);
    console.log('AFTER CALL');
}
main().catch(e => console.error('Fatal:', e.message));
//# sourceMappingURL=debug-cli2.js.map