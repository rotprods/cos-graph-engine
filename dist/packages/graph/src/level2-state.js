"use strict";
// ================================================================
// LEVEL 2: STATE GRAPH — "Máquina de estados"
// FSM: estados, transiciones, acciones, guards
// Refactored: mutation API, adjacency maps, serialization, validation
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachineRegistry = exports.StateMachine = void 0;
const core_1 = require("@cos/core");
class StateMachine {
    definition;
    context;
    listeners = [];
    timeouts = new Map();
    adj = new Map();
    constructor(name, states = [], transitions = [], initial) {
        const id = (0, core_1.generateId)();
        this.definition = {
            id, name, states, transitions,
            initial: initial || (states.find(s => s.type === 'initial')?.id) || states[0]?.id || '',
        };
        this.context = {
            machineId: id,
            currentState: this.definition.initial,
            previousState: null,
            history: [],
            data: {},
            errors: [],
            startedAt: new Date().toISOString(),
            transitions: 0,
        };
        this.buildAdjacency();
    }
    buildAdjacency() {
        this.adj.clear();
        for (const s of this.definition.states)
            this.adj.set(s.id, []);
        for (const t of this.definition.transitions) {
            if (this.adj.has(t.from))
                this.adj.get(t.from).push(t);
        }
    }
    addState(config) {
        if (this.definition.states.some(s => s.id === config.id))
            throw new Error(`State ${config.id} already exists`);
        this.definition.states.push(config);
        this.buildAdjacency();
        return config.id;
    }
    removeState(stateId) {
        const idx = this.definition.states.findIndex(s => s.id === stateId);
        if (idx === -1)
            throw new Error(`State ${stateId} not found`);
        this.definition.states.splice(idx, 1);
        this.definition.transitions = this.definition.transitions.filter(t => t.from !== stateId && t.to !== stateId);
        this.buildAdjacency();
    }
    addTransition(transition) {
        if (!this.definition.states.some(s => s.id === transition.from))
            throw new Error(`From state ${transition.from} not found`);
        if (!this.definition.states.some(s => s.id === transition.to))
            throw new Error(`To state ${transition.to} not found`);
        const id = transition.id || (0, core_1.generateId)();
        this.definition.transitions.push({ ...transition, id });
        this.buildAdjacency();
        return id;
    }
    removeTransition(transitionId) {
        const idx = this.definition.transitions.findIndex(t => t.id === transitionId);
        if (idx === -1)
            throw new Error(`Transition ${transitionId} not found`);
        this.definition.transitions.splice(idx, 1);
        this.buildAdjacency();
    }
    get id() { return this.definition.id; }
    get state() { return this.context.currentState; }
    get contextData() { return { ...this.context }; }
    get states() { return [...this.definition.states]; }
    get transitions() { return [...this.definition.transitions]; }
    async send(event, payload) {
        const transition = this.definition.transitions.find(t => t.from === this.context.currentState && t.event === event);
        if (!transition) {
            this.context.errors.push(`No transition for event "${event}" from state "${this.context.currentState}"`);
            return false;
        }
        if (transition.guard && !transition.guard(this.context)) {
            this.context.errors.push(`Guard blocked transition "${event}" from "${this.context.currentState}"`);
            return false;
        }
        const currentStateConfig = this.definition.states.find(s => s.id === this.context.currentState);
        if (currentStateConfig?.exit) {
            await currentStateConfig.exit(this.context);
        }
        const timeout = this.timeouts.get(this.context.currentState);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(this.context.currentState);
        }
        this.context.previousState = this.context.currentState;
        this.context.history.push({ from: this.context.currentState, to: transition.to, event, timestamp: new Date().toISOString() });
        this.context.currentState = transition.to;
        this.context.transitions++;
        for (const listener of this.listeners) {
            listener(this.context.previousState, this.context.currentState, event);
        }
        if (transition.action) {
            await transition.action(this.context);
        }
        const newStateConfig = this.definition.states.find(s => s.id === transition.to);
        if (newStateConfig?.entry) {
            await newStateConfig.entry(this.context);
        }
        if (newStateConfig?.timeout) {
            const timeoutId = setTimeout(async () => { await this.send('timeout'); }, newStateConfig.timeout * 1000);
            this.timeouts.set(transition.to, timeoutId);
        }
        return true;
    }
    can(event) {
        return this.definition.transitions.some(t => t.from === this.context.currentState && t.event === event);
    }
    getAvailableEvents() {
        return this.definition.transitions.filter(t => t.from === this.context.currentState).map(t => t.event);
    }
    isInFinalState() {
        const state = this.definition.states.find(s => s.id === this.context.currentState);
        return state?.type === 'final';
    }
    onChange(listener) {
        this.listeners.push(listener);
    }
    visualize() {
        let result = `╔════════════════════════════════════════════════╗\n`;
        result += `║  FSM: ${this.definition.name.padEnd(41)}║\n`;
        result += `╚════════════════════════════════════════════════╝\n\n`;
        result += `  Current State: ${this.context.currentState}\n`;
        result += `  Transitions: ${this.context.transitions}\n`;
        result += `  History: ${this.context.history.length} events\n`;
        result += `  Errors: ${this.context.errors.length}\n`;
        result += `  Available events: ${this.getAvailableEvents().join(', ') || 'none'}\n\n`;
        result += `  States:\n`;
        for (const state of this.definition.states) {
            const marker = state.id === this.context.currentState ? '→' : ' ';
            const typeIcon = state.type === 'initial' ? '●' : state.type === 'final' ? '◉' : '○';
            result += `  ${marker} ${typeIcon} ${state.label} (${state.id})\n`;
        }
        result += `\n  Transitions:\n`;
        for (const t of this.definition.transitions) {
            result += `    ${t.from} ──[${t.event}]──→ ${t.to}\n`;
        }
        return result;
    }
    validate() {
        const errors = [];
        if (!this.definition.initial)
            errors.push('No initial state defined');
        if (this.definition.states.length === 0)
            errors.push('No states defined');
        const ids = new Set();
        for (const s of this.definition.states) {
            if (ids.has(s.id))
                errors.push(`Duplicate state id: ${s.id}`);
            ids.add(s.id);
        }
        for (const t of this.definition.transitions) {
            if (!this.definition.states.some(s => s.id === t.from))
                errors.push(`Dangling transition from: ${t.from}`);
            if (!this.definition.states.some(s => s.id === t.to))
                errors.push(`Dangling transition to: ${t.to}`);
        }
        return errors;
    }
    metrics() {
        const n = this.definition.states.length;
        const t = this.definition.transitions.length;
        const events = [...new Set(this.definition.transitions.map(tr => tr.event))];
        const finalStates = this.definition.states.filter(s => s.type === 'final').length;
        return { stateCount: n, transitionCount: t, uniqueEvents: events.length, finalStates, historyLength: this.context.history.length, totalTransitions: this.context.transitions, errorCount: this.context.errors.length };
    }
    toJSON() { return JSON.parse(JSON.stringify(this.definition)); }
    static fromJSON(data) {
        const m = new StateMachine(data.name, [], [], data.initial);
        m.definition.states = data.states.map(s => ({ ...s }));
        m.definition.transitions = data.transitions.map(t => ({ ...t }));
        m.buildAdjacency();
        return m;
    }
    toMermaid() {
        let m = `stateDiagram-v2\n  title: "${this.definition.name}"\n`;
        for (const s of this.definition.states) {
            const type = s.type === 'initial' ? ' [*]' : s.type === 'final' ? ' [*]' : '';
            if (s.type === 'initial')
                m += `  [*] --> ${s.id}\n`;
            if (s.type === 'final')
                m += `  ${s.id} --> [*]\n`;
        }
        for (const t of this.definition.transitions) {
            m += `  ${t.from} --> ${t.to}: ${t.event}\n`;
        }
        return m;
    }
}
exports.StateMachine = StateMachine;
class StateMachineRegistry {
    machines = new Map();
    create(name, states, transitions, initial) {
        const machine = new StateMachine(name, states, transitions, initial);
        this.machines.set(machine.id, machine);
        return machine;
    }
    get(id) { return this.machines.get(id); }
    getAll() { return Array.from(this.machines.values()); }
    remove(id) { this.machines.delete(id); }
    createCognitiveLifecycle() {
        return this.create('CognitiveCell Lifecycle', [
            { id: 'created', label: 'Created', type: 'initial' },
            { id: 'initializing', label: 'Initializing' },
            { id: 'ready', label: 'Ready' },
            { id: 'running', label: 'Running' },
            { id: 'paused', label: 'Paused' },
            { id: 'error', label: 'Error', type: 'error' },
            { id: 'terminated', label: 'Terminated', type: 'final' },
        ], [
            { from: 'created', to: 'initializing', event: 'init' },
            { from: 'initializing', to: 'ready', event: 'ready' },
            { from: 'initializing', to: 'error', event: 'fail' },
            { from: 'ready', to: 'running', event: 'start' },
            { from: 'running', to: 'paused', event: 'pause' },
            { from: 'paused', to: 'running', event: 'resume' },
            { from: 'running', to: 'error', event: 'fail' },
            { from: 'running', to: 'terminated', event: 'shutdown' },
            { from: 'paused', to: 'terminated', event: 'shutdown' },
            { from: 'error', to: 'terminated', event: 'shutdown' },
            { from: 'error', to: 'ready', event: 'recover' },
        ]);
    }
    createAutonomousGoalFSM() {
        return this.create('Autonomous Goal', [
            { id: 'created', label: 'Created', type: 'initial' },
            { id: 'planning', label: 'Planning' },
            { id: 'executing', label: 'Executing' },
            { id: 'observing', label: 'Observing' },
            { id: 'adapting', label: 'Adapting' },
            { id: 'completed', label: 'Completed', type: 'final' },
            { id: 'failed', label: 'Failed', type: 'error' },
        ], [
            { from: 'created', to: 'planning', event: 'start' },
            { from: 'planning', to: 'executing', event: 'plan_ready' },
            { from: 'planning', to: 'failed', event: 'plan_failed' },
            { from: 'executing', to: 'observing', event: 'step_complete' },
            { from: 'executing', to: 'failed', event: 'step_failed' },
            { from: 'observing', to: 'executing', event: 'continue' },
            { from: 'observing', to: 'adapting', event: 'needs_adapt' },
            { from: 'observing', to: 'completed', event: 'all_done' },
            { from: 'adapting', to: 'planning', event: 'replan' },
            { from: 'adapting', to: 'failed', event: 'cannot_adapt' },
        ]);
    }
}
exports.StateMachineRegistry = StateMachineRegistry;
//# sourceMappingURL=level2-state.js.map