/**
 * COS Graph Engine — WebAssembly Runtime (Fase 13)
 *
 * Proporciona:
 * 1. WASM module interface para L1, L3, L7
 * 2. WASM runtime simulator (JS fallback con perfil de rendimiento)
 * 3. Bindings para JS/TS, Python, Rust
 * 4. Benchmarks WASM vs JS
 * 5. Zero dependencias externas
 */
export interface WASMModule {
    /** Module name matching the level */
    name: string;
    /** WASM binary size in bytes (simulated) */
    wasmSize: number;
    /** Whether the module is compiled */
    compiled: boolean;
    /** Memory pages (64KB each) */
    memoryPages: number;
    /** Exported functions */
    exports: string[];
    /** Version */
    version: string;
}
export interface WASMOperation {
    name: string;
    wasmNs: number;
    jsNs: number;
    speedup: number;
}
export interface WASMBenchmark {
    module: string;
    operations: WASMOperation[];
    averageSpeedup: number;
    wasmTotalNs: number;
    jsTotalNs: number;
    timestamp: number;
}
export interface WASMRuntimeConfig {
    /** Enable WASM mode (simulated) */
    useWasm: boolean;
    /** Memory pages to allocate */
    memoryPages: number;
    /** Logging level */
    logLevel: 'none' | 'basic' | 'verbose';
    /** Cache compiled modules */
    cache: boolean;
}
export declare const WASM_MODULES: Record<string, WASMModule>;
export declare class WASMRuntime {
    private config;
    private modules;
    private memory;
    private callCount;
    private totalWasmTime;
    private totalJsTime;
    constructor(config?: Partial<WASMRuntimeConfig>);
    /** Allocate linear memory for a module */
    private allocateMemory;
    /** Get a module's memory view */
    getMemory(module: string): Float64Array | undefined;
    /** Get a module definition */
    getModule(level: string): WASMModule | undefined;
    /** List all compiled modules */
    listModules(): WASMModule[];
    /** Get module info */
    getModuleInfo(level: string): {
        module: WASMModule;
        memoryUsed: number;
        calls: number;
    } | undefined;
    /** Simulate a WASM call — returns execution time in nanoseconds */
    callWasm(level: string, fn: string, args?: number[]): {
        result: number;
        timeNs: number;
    };
    /** Simulate equivalent JS call — returns execution time in nanoseconds */
    callJs(level: string, fn: string, args?: number[]): {
        result: number;
        timeNs: number;
    };
    /** Run a benchmark between WASM and JS */
    runBenchmark(level: string, fn: string, iterations?: number, args?: number[]): WASMOperation;
    /** Run full benchmark suite across all modules */
    runFullBenchmark(): WASMBenchmark[];
    /** Get runtime stats */
    getStats(): {
        config: WASMRuntimeConfig;
        modules: number;
        totalCalls: number;
        totalWasmTime: number;
        totalJsTime: number;
        memoryUsage: number;
    };
    /** Update config */
    updateConfig(config: Partial<WASMRuntimeConfig>): void;
}
export interface WASMBinding {
    language: string;
    module: string;
    code: string;
    description: string;
}
export declare class WASMSDK {
    private runtime;
    constructor(runtime?: WASMRuntime);
    /** Generate JS/TS binding for a WASM module */
    generateJSBinding(level: string): string;
    /** Generate Python binding */
    generatePythonBinding(level: string): string;
    /** Generate Rust binding */
    generateRustBinding(level: string): string;
    /** Generate all bindings for a level */
    generateAllBindings(level: string): WASMBinding[];
}
export declare const wasmRuntime: WASMRuntime;
export declare const wasmSDK: WASMSDK;
//# sourceMappingURL=wasm.d.ts.map