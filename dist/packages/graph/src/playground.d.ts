/**
 * Playground Interactivo y Tutoriales — Fase 18
 *
 * T-18.1: Playground Interactivo — REPL 'cos playground L4'
 * T-18.2: Tutoriales Interactivos — 20 tutoriales 'cos tutorial L17'
 *
 * Zero dependencias externas.
 */
export interface PlaygroundCommand {
    name: string;
    description: string;
    args: string;
    handler: (args: string[], ctx: PlaygroundContext) => string;
}
export interface PlaygroundContext {
    level: number;
    levelName: string;
    graph: Record<string, unknown>;
    state: Map<string, unknown>;
}
export interface PlaygroundResult {
    success: boolean;
    output: string;
    suggestions?: string[];
}
export interface TutorialStep {
    id: string;
    title: string;
    description: string;
    expectedCommand: string;
    hint: string;
    validate: (input: string, ctx: PlaygroundContext) => {
        passed: boolean;
        message: string;
    };
}
export interface Tutorial {
    id: string;
    level: number;
    title: string;
    description: string;
    steps: TutorialStep[];
    completed: boolean;
}
export declare class LevelPlayground {
    level: number;
    levelName: string;
    description: string;
    commands: PlaygroundCommand[];
    context: PlaygroundContext;
    constructor(level: number);
    private buildCommands;
    /**
     * Ejecutar un comando en el playground.
     */
    execute(input: string): PlaygroundResult;
    /**
     * Obtener ayuda de un comando especifico.
     */
    commandHelp(name: string): string | undefined;
}
export declare class PlaygroundSession {
    private playgrounds;
    private currentLevel;
    private history;
    private maxHistory;
    /**
     * Iniciar sesion en un nivel.
     */
    start(level: number): PlaygroundResult;
    /**
     * Ejecutar un comando en la sesion actual.
     */
    execute(input: string): PlaygroundResult;
    /**
     * Obtener el nivel actual.
     */
    getCurrentLevel(): number;
    /**
     * Listar todos los niveles disponibles.
     */
    listLevels(): string;
    /**
     * Ejecutar una secuencia de comandos.
     */
    runScript(commands: string[]): PlaygroundResult[];
}
export declare class Tutorial {
    id: string;
    level: number;
    title: string;
    description: string;
    steps: TutorialStep[];
    currentStep: number;
    completed: boolean;
    constructor(id: string, level: number, title: string, description: string, steps: TutorialStep[]);
    /**
     * Obtener el paso actual.
     */
    getCurrentStep(): TutorialStep | null;
    /**
     * Avanzar al siguiente paso.
     */
    nextStep(): TutorialStep | null;
    /**
     * Reiniciar el tutorial.
     */
    reset(): void;
    /**
     * Progreso del tutorial.
     */
    progress(): {
        current: number;
        total: number;
        percent: number;
    };
}
export declare class TutorialRegistry {
    private tutorials;
    constructor();
    private registerAll;
    private registerTutorial;
    /**
     * Obtener un tutorial por ID o nivel.
     */
    get(idOrLevel: string): Tutorial | undefined;
    /**
     * Listar todos los tutoriales.
     */
    list(): Array<{
        id: string;
        level: number;
        title: string;
        steps: number;
    }>;
    /**
     * Contar tutoriales.
     */
    count(): number;
    /**
     * Contar completados.
     */
    completedCount(): number;
}
export declare class TutorialRunner {
    private registry;
    private currentTutorial;
    private playground;
    constructor();
    /**
     * Iniciar un tutorial por nivel o ID.
     */
    start(levelOrId: string): PlaygroundResult;
    /**
     * Ejecutar un comando en el tutorial actual.
     */
    execute(input: string): PlaygroundResult;
    /**
     * Listar tutoriales disponibles.
     */
    listTutorials(): string;
    /**
     * Obtener el tutorial actual.
     */
    getCurrent(): Tutorial | null;
    /**
     * Obtener el registry.
     */
    getRegistry(): TutorialRegistry;
}
//# sourceMappingURL=playground.d.ts.map