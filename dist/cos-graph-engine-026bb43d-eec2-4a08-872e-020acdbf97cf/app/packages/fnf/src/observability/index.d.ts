import type { GenerationBackend, MediaBackend, ProfileBackend } from '../backend';
import type { BinaryUploader } from '../media/types';
import type { Transport } from '../transport';
export type FnfObservationPhase = 'start' | 'success' | 'error' | 'event';
export type FnfObservationAttributeValue = string | number | boolean | null;
export type FnfObservationAttributes = Record<string, FnfObservationAttributeValue>;
export interface FnfObservationError {
    code: string;
    status?: number;
    name?: string;
}
export interface FnfObservationEvent {
    id: string;
    traceId: string;
    parentId?: string;
    name: string;
    phase: FnfObservationPhase;
    timestamp: number;
    durationMs?: number;
    attributes: FnfObservationAttributes;
    error?: FnfObservationError;
}
export type FnfObserver = (event: FnfObservationEvent) => void | Promise<void>;
export interface FnfObservabilityOptions {
    observer?: FnfObserver;
    traceId?: string;
    parentId?: string;
    attributes?: FnfObservationAttributes | (() => FnfObservationAttributes);
    onObserverError?: (error: unknown, event: FnfObservationEvent) => void;
    now?: () => number;
    idFactory?: () => string;
}
export interface FnfObservabilityContext {
    observer?: FnfObserver;
    traceId: string;
    parentId?: string;
    attributes: () => FnfObservationAttributes;
    onObserverError?: (error: unknown, event: FnfObservationEvent) => void;
    now: () => number;
    idFactory: () => string;
}
export interface ObserveAsyncOptions<T> {
    parentId?: string;
    attributes?: FnfObservationAttributes;
    successAttributes?: (result: T) => FnfObservationAttributes;
    errorAttributes?: (error: unknown) => FnfObservationAttributes;
}
export declare function createNoopObserver(): FnfObserver;
export declare function composeObservers(...observers: Array<FnfObserver | undefined | null | false>): FnfObserver;
export declare function createConsoleObserver(consoleLike?: Pick<Console, 'debug' | 'error'>): FnfObserver;
export declare function createObservabilityContext(options?: FnfObservabilityOptions): FnfObservabilityContext;
export declare function observeEvent(ctx: FnfObservabilityContext | FnfObservabilityOptions | undefined, name: string, attributes?: FnfObservationAttributes, options?: {
    parentId?: string;
    phase?: FnfObservationPhase;
    error?: unknown;
    durationMs?: number;
}): void;
export declare function observeAsync<T>(ctx: FnfObservabilityContext | FnfObservabilityOptions | undefined, name: string, attributes: FnfObservationAttributes, fn: () => Promise<T>, options?: ObserveAsyncOptions<T>): Promise<T>;
export declare function withObservedTransport(transport: Transport, observability?: FnfObservabilityOptions | FnfObservabilityContext): Transport;
export declare function withObservedGenerationBackend(backend: GenerationBackend, observability?: FnfObservabilityOptions | FnfObservabilityContext): GenerationBackend;
export declare function withObservedMediaBackend(backend: MediaBackend, observability?: FnfObservabilityOptions | FnfObservabilityContext): MediaBackend;
export declare function withObservedProfileBackend(backend: ProfileBackend, observability?: FnfObservabilityOptions | FnfObservabilityContext): ProfileBackend;
export declare function withObservedUploader(uploader: BinaryUploader, observability?: FnfObservabilityOptions | FnfObservabilityContext): BinaryUploader;
//# sourceMappingURL=index.d.ts.map