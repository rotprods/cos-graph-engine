import type { FnfObservabilityOptions } from '@higgsfield/fnf/observability';
import type { GenerationRunClient } from './generation-run';
import type { FnfScopeOptions } from './keys';
import { GenerationRun } from './generation-run';
export type GenerationRunHookOptions = FnfScopeOptions & {
    observability?: FnfObservabilityOptions;
};
/**
 * A submit-to-terminal lifecycle bound to the component (requires a
 * `QueryClientProvider` above). Every run commit folds the live snapshots
 * into the shared query cache through `applyGenerations` — pending tiles
 * tick in any feed/job-set view that holds them, no extra wiring. Which feed
 * should SHOW a fresh submit stays your explicit call: `prependGenerations`.
 * Polling is aborted on unmount (the backend job keeps running — cancel
 * server-side via `client.cancel` if that's the intent).
 *
 * `client` must be referentially stable (module scope / context / useState) —
 * the controller binds to the first one; an inline-created client would be
 * silently ignored after mount.
 *
 *   const run = useGenerationRun(client, { scopeKey })
 *   useEffect(() => { // optimistic tiles: the submit landed, polling begins
 *     if (run.status === 'generating')
 *       prependGenerations(queryClient, { type: 'video' }, run.generations, { scopeKey })
 *   }, [run.status])
 *   <button onClick={() => run.start(input)} disabled={run.isRunning}>
 *   {run.error && <ErrorNote code={run.error.code} />}
 */
export declare function useGenerationRun<Input>(client: GenerationRunClient<Input>, opts?: GenerationRunHookOptions): GenerationRun<Input>;
//# sourceMappingURL=generation-run-hook.d.ts.map