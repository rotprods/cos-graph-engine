import type { GenerationContext } from './context';
/**
 * Cancel a running job SERVER-SIDE. This is the counterpart to the client-side
 * `signal` on poll/wait: aborting only stops polling — the backend job keeps
 * running (and burning credits) until cancelled here.
 *
 * Requires the adapter to implement the optional `cancelJob` port method;
 * otherwise throws the typed `cancel_not_supported` error.
 */
export declare function cancelGeneration(ctx: GenerationContext, id: string): Promise<void>;
//# sourceMappingURL=cancel.d.ts.map