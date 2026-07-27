import { EntityId, Timestamp } from '@cos/core';
export type StateId = string;
export interface StateTransition {
    id?: string;
    from: StateId;
    to: StateId;
    event: string;
    guard?: (context: StateContext) => boolean;
    action?: (context: StateContext) => Promise<void> | void;
    label?: string;
}
export interface StateConfig {
    id: StateId;
    label: string;
    entry?: (context: StateContext) => Promise<void> | void;
    exit?: (context: StateContext) => Promise<void> | void;
    type?: 'initial' | 'normal' | 'final' | 'error';
    timeout?: number;
}
export interface StateContext {
    machineId: EntityId;
    currentState: StateId;
    previousState: StateId | null;
    history: Array<{
        from: StateId;
        to: StateId;
        event: string;
        timestamp: Timestamp;
    }>;
    data: Record<string, unknown>;
    errors: string[];
    startedAt: Timestamp;
    transitions: number;
}
export interface StateMachineDefinition {
    id: EntityId;
    name: string;
    states: StateConfig[];
    transitions: StateTransition[];
    initial: StateId;
}
export declare class StateMachine {
    private definition;
    private context;
    private listeners;
    private timeouts;
    private adj;
    constructor(name: string, states?: StateConfig[], transitions?: StateTransition[], initial?: StateId);
    private buildAdjacency;
    addState(config: StateConfig): StateId;
    removeState(stateId: StateId): void;
    addTransition(transition: StateTransition): string;
    removeTransition(transitionId: string): void;
    get id(): EntityId;
    get state(): StateId;
    get contextData(): StateContext;
    get states(): StateConfig[];
    get transitions(): StateTransition[];
    send(event: string, payload?: Record<string, unknown>): Promise<boolean>;
    can(event: string): boolean;
    getAvailableEvents(): string[];
    isInFinalState(): boolean;
    onChange(listener: (from: StateId, to: StateId, event: string) => void): void;
    visualize(): string;
    validate(): string[];
    metrics(): {
        stateCount: number;
        transitionCount: number;
        uniqueEvents: number;
        finalStates: number;
        historyLength: number;
        totalTransitions: number;
        errorCount: number;
    };
    toJSON(): StateMachineDefinition;
    static fromJSON(data: StateMachineDefinition): StateMachine;
    toMermaid(): string;
}
export declare class StateMachineRegistry {
    private machines;
    create(name: string, states: StateConfig[], transitions: StateTransition[], initial?: StateId): StateMachine;
    get(id: EntityId): StateMachine | undefined;
    getAll(): StateMachine[];
    remove(id: EntityId): void;
    createCognitiveLifecycle(): StateMachine;
    createAutonomousGoalFSM(): StateMachine;
}
//# sourceMappingURL=level2-state.d.ts.map