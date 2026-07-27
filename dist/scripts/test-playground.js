"use strict";
/**
 * Tests de Playground y Tutoriales (Fase 18)
 * T-18.1: LevelPlayground, PlaygroundSession
 * T-18.2: Tutorial, TutorialRegistry, TutorialRunner
 */
Object.defineProperty(exports, "__esModule", { value: true });
const playground_1 = require("../packages/graph/src/playground");
let passed = 0;
let failed = 0;
function assert(condition, msg) {
    if (condition) {
        passed++;
    }
    else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}
function section(name) { console.log(`\n=== ${name} ===`); }
async function main() {
    // =============================================
    // T-18.1: LevelPlayground
    // =============================================
    section('LevelPlayground — Construction');
    const pg0 = new playground_1.LevelPlayground(0);
    assert(pg0 !== undefined, 'LevelPlayground L0 constructed');
    assert(pg0.level === 0, 'Level is 0');
    assert(pg0.levelName === 'Visual Graph', 'Level name correct');
    assert(pg0.commands.length >= 5, 'Has multiple commands');
    section('LevelPlayground — All levels constructible');
    for (let l = 0; l <= 19; l++) {
        const pg = new playground_1.LevelPlayground(l);
        assert(pg.level === l, `Level ${l} constructs correctly`);
        assert(pg.levelName.length > 0, `Level ${l} has name`);
    }
    section('LevelPlayground — Invalid level');
    try {
        new playground_1.LevelPlayground(99);
        assert(false, 'Should throw on invalid level');
    }
    catch (e) {
        assert(e.message.includes('not found'), 'Invalid level throws');
    }
    section('LevelPlayground — help command');
    const helpResult = pg0.execute('help');
    assert(helpResult.success === true, 'Help succeeds');
    assert(helpResult.output.includes('create'), 'Help includes create');
    assert(helpResult.output.includes('add'), 'Help includes add');
    assert(helpResult.output.includes('help'), 'Help includes help');
    section('LevelPlayground — info command');
    const infoResult = pg0.execute('info');
    assert(infoResult.success === true, 'Info succeeds');
    assert(infoResult.output.includes('Level 0'), 'Info shows level');
    assert(infoResult.output.includes('Visual Graph'), 'Info shows name');
    section('LevelPlayground — create command');
    const createResult = pg0.execute('create');
    assert(createResult.success === true, 'Create succeeds');
    assert(createResult.output.includes('graph_0'), 'Create uses default name');
    section('LevelPlayground — create with name');
    const createNamed = pg0.execute('create my-graph');
    assert(createNamed.success === true, 'Create with name succeeds');
    assert(createNamed.output.includes('my-graph'), 'Create uses custom name');
    section('LevelPlayground — add node');
    const addResult = pg0.execute('add node-A');
    assert(addResult.success === true, 'Add succeeds');
    assert(addResult.output.includes('node-A'), 'Add shows node id');
    section('LevelPlayground — add node with type');
    const addTyped = pg0.execute('add node-B entity');
    assert(addTyped.success === true, 'Add with type succeeds');
    assert(addTyped.output.includes('entity'), 'Add shows type');
    section('LevelPlayground — list nodes');
    const listResult = pg0.execute('list');
    assert(listResult.success === true, 'List succeeds');
    assert(listResult.output.includes('node-A'), 'List shows node-A');
    assert(listResult.output.includes('node-B'), 'List shows node-B');
    section('LevelPlayground — edge command');
    const edgeResult = pg0.execute('edge node-A node-B');
    assert(edgeResult.success === true, 'Edge succeeds');
    assert(edgeResult.output.includes('node-A'), 'Edge shows source');
    section('LevelPlayground — edge without args');
    const edgeNoArgs = pg0.execute('edge');
    assert(edgeNoArgs.success === true, 'Edge without args still succeeds');
    assert(edgeNoArgs.output.includes('Usage'), 'Edge shows usage');
    section('LevelPlayground — stats');
    const statsResult = pg0.execute('stats');
    assert(statsResult.success === true, 'Stats succeeds');
    assert(statsResult.output.includes('Nodes:'), 'Stats shows nodes');
    section('LevelPlayground — remove node');
    const removeResult = pg0.execute('remove node-A');
    assert(removeResult.success === true, 'Remove succeeds');
    assert(removeResult.output.includes('node-A'), 'Remove shows node id');
    section('LevelPlayground — remove nonexistent');
    const removeBad = pg0.execute('remove nonexistent');
    assert(removeBad.success === true, 'Remove nonexistent returns success');
    assert(removeBad.output.includes('not found'), 'Remove shows not found');
    section('LevelPlayground — clear');
    const clearResult = pg0.execute('clear');
    assert(clearResult.success === true, 'Clear succeeds');
    assert(clearResult.output.includes('cleared'), 'Clear output');
    section('LevelPlayground — unknown command');
    const unknown = pg0.execute('foobar');
    assert(unknown.success === false, 'Unknown command returns failure');
    assert(unknown.output.includes('Unknown'), 'Unknown command message');
    section('LevelPlayground — exec on level 1');
    const pg1 = new playground_1.LevelPlayground(1);
    const execResult = pg1.execute('exec');
    assert(execResult.success === true, 'Exec on L1 succeeds');
    assert(execResult.output.includes('Execution graph'), 'Exec creates execution graph');
    section('LevelPlayground — exec on level 0');
    const execOnL0 = pg0.execute('exec');
    assert(execOnL0.success === true, 'Exec on L0 returns message');
    assert(execOnL0.output.includes('not available'), 'Exec on L0 shows not available');
    section('LevelPlayground — visualize');
    const pg0v = new playground_1.LevelPlayground(0);
    pg0v.execute('create');
    pg0v.execute('add A');
    pg0v.execute('add B');
    const visResult = pg0v.execute('visualize');
    assert(visResult.success === true, 'Visualize succeeds');
    section('LevelPlayground — exit');
    const exitResult = pg0.execute('exit');
    assert(exitResult.success === true, 'Exit succeeds');
    assert(exitResult.output.includes('Goodbye'), 'Exit message');
    section('LevelPlayground — commandHelp');
    const help = pg0.commandHelp('create');
    assert(help !== undefined, 'commandHelp returns help');
    assert(help.includes('create'), 'Help includes command name');
    const noHelp = pg0.commandHelp('nonexistent');
    assert(noHelp === undefined, 'commandHelp returns undefined for unknown');
    // =============================================
    // T-18.1: PlaygroundSession
    // =============================================
    section('PlaygroundSession — Construction');
    const session = new playground_1.PlaygroundSession();
    assert(session !== undefined, 'PlaygroundSession constructed');
    assert(typeof session.execute === 'function', 'Has execute method');
    section('PlaygroundSession — Start level');
    const startResult = session.start(4);
    assert(startResult.success === true, 'Start L4 succeeds');
    assert(startResult.output.includes('Level 4'), 'Start shows level');
    assert(startResult.output.includes('Call Graph'), 'Start shows level name');
    assert(session.getCurrentLevel() === 4, 'Current level is 4');
    section('PlaygroundSession — Execute command');
    const cmdResult = session.execute('create');
    assert(cmdResult.success === true, 'Session execute works');
    section('PlaygroundSession — Switch level with L<number>');
    const switchResult = session.execute('L8');
    assert(switchResult.success === true, 'Switch to L8 succeeds');
    assert(switchResult.output.includes('Level 8'), 'Switched to level 8');
    assert(session.getCurrentLevel() === 8, 'Current level is 8');
    section('PlaygroundSession — Switch level with "level N"');
    const switchResult2 = session.execute('level 12');
    assert(switchResult2.success === true, 'Switch to L12 with level command');
    assert(session.getCurrentLevel() === 12, 'Current level is 12');
    section('PlaygroundSession — History');
    const histResult = session.execute('history');
    assert(histResult.success === true, 'History command works');
    assert(histResult.output.includes('L8'), 'History includes previous commands');
    section('PlaygroundSession — List levels');
    const levels = session.listLevels();
    assert(levels.includes('L 0'), 'Levels list includes L0');
    assert(levels.includes('L19'), 'Levels list includes L19');
    assert(levels.includes('Visual Graph'), 'Levels list includes Visual Graph');
    section('PlaygroundSession — Run script');
    const scriptResults = session.runScript(['create', 'add test', 'stats']);
    assert(scriptResults.length === 3, 'Script returns 3 results');
    assert(scriptResults[0].success === true, 'Script first command succeeds');
    assert(scriptResults[1].success === true, 'Script second command succeeds');
    // =============================================
    // T-18.2: Tutorial
    // =============================================
    section('Tutorial — Construction');
    const steps = [
        { id: 's1', title: 'Step 1', description: 'Do this', expectedCommand: 'create', hint: 'Use create', validate: (i) => ({ passed: i.includes('create'), message: 'Type create' }) },
        { id: 's2', title: 'Step 2', description: 'Do that', expectedCommand: 'add', hint: 'Use add', validate: (i) => ({ passed: i.includes('add'), message: 'Type add' }) },
    ];
    const tutorial = new playground_1.Tutorial('T1', 0, 'Test Tutorial', 'A test tutorial', steps);
    assert(tutorial !== undefined, 'Tutorial constructed');
    assert(tutorial.id === 'T1', 'Tutorial id');
    assert(tutorial.level === 0, 'Tutorial level');
    assert(tutorial.steps.length === 2, '2 steps');
    section('Tutorial — getCurrentStep');
    const step = tutorial.getCurrentStep();
    assert(step !== null, 'getCurrentStep returns step');
    assert(step.id === 's1', 'First step is s1');
    section('Tutorial — nextStep');
    const next = tutorial.nextStep();
    assert(next !== null, 'nextStep returns next step');
    assert(next.id === 's2', 'Second step is s2');
    section('Tutorial — progress');
    const prog = tutorial.progress();
    assert(prog.current === 1, 'Progress current is 1');
    assert(prog.total === 2, 'Progress total is 2');
    assert(prog.percent === 50, 'Progress percent is 50');
    section('Tutorial — complete');
    tutorial.nextStep();
    assert(tutorial.completed === true, 'Tutorial completed after last step');
    assert(tutorial.getCurrentStep() === null, 'No current step when completed');
    section('Tutorial — reset');
    tutorial.reset();
    assert(tutorial.currentStep === 0, 'Reset goes to step 0');
    assert(tutorial.completed === false, 'Reset clears completed');
    // =============================================
    // T-18.2: TutorialRegistry
    // =============================================
    section('TutorialRegistry — Construction');
    const registry = new playground_1.TutorialRegistry();
    assert(registry !== undefined, 'TutorialRegistry constructed');
    assert(registry.count() === 20, '20 tutorials registered');
    section('TutorialRegistry — Get by id');
    const t0 = registry.get('L0');
    assert(t0 !== undefined, 'Get L0 by id');
    assert(t0.level === 0, 'L0 level is 0');
    assert(t0.title === 'Visual Graph', 'L0 title correct');
    section('TutorialRegistry — Get by level number');
    const t12 = registry.get('12');
    assert(t12 !== undefined, 'Get level 12 by number');
    assert(t12.level === 12, 'Level 12 correct');
    assert(t12.title === 'Memory Graph', 'L12 title correct');
    section('TutorialRegistry — Get nonexistent');
    const none = registry.get('nonexistent');
    assert(none === undefined, 'Get nonexistent returns undefined');
    section('TutorialRegistry — List');
    const list = registry.list();
    assert(list.length === 20, 'List returns 20 tutorials');
    assert(list[0].id === 'L0', 'First tutorial is L0');
    assert(list[19].id === 'L19', 'Last tutorial is L19');
    section('TutorialRegistry — All levels have correct names');
    const names = ['Visual Graph', 'Execution Graph', 'State Machine', 'Dependency Resolver',
        'Call Graph', 'Control Flow Graph', 'Data Flow Graph', 'Computational Graph', 'Knowledge Graph', 'Semantic Graph',
        'Embedding Graph', 'GraphRAG', 'Memory Graph', 'Agent Graph', 'Tool Graph',
        'Workflow Graph', 'Network Graph', 'Social Graph', 'Biological Graph', 'Molecular Graph'];
    for (let i = 0; i < 20; i++) {
        const t = registry.get(String(i));
        assert(t !== undefined, `L${i} exists`);
        assert(t.title === names[i], `L${i} title is "${names[i]}"`);
    }
    section('TutorialRegistry — All tutorials have 3 steps');
    for (let i = 0; i < 20; i++) {
        const t = registry.get(String(i));
        assert(t.steps.length === 3, `L${i} has 3 steps`);
    }
    section('TutorialRegistry — completedCount');
    const cc = registry.completedCount();
    assert(cc === 0, 'No tutorials completed initially');
    // =============================================
    // T-18.2: TutorialRunner
    // =============================================
    section('TutorialRunner — Construction');
    const runner = new playground_1.TutorialRunner();
    assert(runner !== undefined, 'TutorialRunner constructed');
    assert(typeof runner.start === 'function', 'Has start method');
    assert(typeof runner.execute === 'function', 'Has execute method');
    section('TutorialRunner — Start tutorial');
    const startTut = runner.start('L0');
    assert(startTut.success === true, 'Start L0 tutorial succeeds');
    assert(startTut.output.includes('Visual Graph'), 'Start shows tutorial title');
    assert(startTut.output.includes('Step 1'), 'Start shows step 1');
    section('TutorialRunner — Execute correct command');
    const execCorrect = runner.execute('create');
    assert(execCorrect.success === true, 'Correct command succeeds');
    assert(execCorrect.output.includes('Step 2'), 'Advances to step 2');
    section('TutorialRunner — Execute wrong command');
    const execWrong = runner.execute('wrong');
    assert(execWrong.success === false, 'Wrong command fails');
    assert(execWrong.output.includes('add'), 'Shows hint about add');
    section('TutorialRunner — Hint command');
    const hintResult = runner.execute('hint');
    assert(hintResult.success === true, 'Hint command works');
    assert(hintResult.output.includes('Hint'), 'Hint output');
    section('TutorialRunner — Skip command');
    const skipResult = runner.execute('skip');
    assert(skipResult.success === true, 'Skip command works');
    assert(skipResult.output.toLowerCase().includes('step 3'), 'Skip advances to step 3');
    section('TutorialRunner — Progress');
    const progResult = runner.execute('progress');
    assert(progResult.success === true, 'Progress command works');
    assert(progResult.output.includes('Progress'), 'Progress output');
    section('TutorialRunner — Complete tutorial');
    runner.execute('skip');
    const complete = runner.execute('skip');
    assert(complete.success === true, 'Complete tutorial');
    assert(complete.output.includes('completed'), 'Completion message');
    section('TutorialRunner — Execute after completion');
    const afterComplete = runner.execute('create');
    assert(afterComplete.success === true, 'Execute after completion shows message');
    assert(afterComplete.output.includes('completed'), 'Shows completed message');
    section('TutorialRunner — Start non-existent');
    const badStart = runner.start('L99');
    assert(badStart.success === false, 'Start non-existent fails');
    assert(badStart.output.includes('not found'), 'Not found message');
    section('TutorialRunner — List tutorials');
    const tutList = runner.listTutorials();
    assert(tutList.includes('L0'), 'List includes L0');
    assert(tutList.includes('L19'), 'List includes L19');
    assert(tutList.includes('Visual Graph'), 'List includes Visual Graph');
    section('TutorialRunner — getCurrent');
    const current = runner.getCurrent();
    assert(current !== null, 'Current tutorial is still set');
    assert(current.completed === true, 'Tutorial is marked as completed');
    // =============================================
    // Summary
    // =============================================
    section('Summary');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=test-playground.js.map