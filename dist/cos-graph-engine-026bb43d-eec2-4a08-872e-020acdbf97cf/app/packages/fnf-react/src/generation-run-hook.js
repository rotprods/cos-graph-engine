"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGenerationRun = useGenerationRun;
const react_query_1 = require("@tanstack/react-query");
const react_1 = require("react");
const external_store_hook_1 = require("./external-store-hook");
const generation_cache_1 = require("./generation-cache");
const generation_run_1 = require("./generation-run");
const provider_1 = require("./provider");
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
function useGenerationRun(client, opts) {
    const providerObservability = (0, provider_1.useOptionalFnfObservability)();
    const observability = opts?.observability ?? providerObservability;
    // useState, not useMemo: a controller holds state, and useMemo is a cache
    // React may discard — recreation would silently wipe the run.
    const [run] = (0, react_1.useState)(() => new generation_run_1.GenerationRun(client, { observability }));
    const queryClient = (0, react_query_1.useQueryClient)();
    (0, react_1.useEffect)(() => {
        const unsubscribe = run.subscribe(() => (0, generation_cache_1.applyGenerations)(queryClient, run.generations, opts));
        return () => {
            unsubscribe();
            run.abort();
        };
    }, [run, queryClient, opts?.scopeKey]);
    return (0, external_store_hook_1.useStore)(run);
}
//# sourceMappingURL=generation-run-hook.js.map