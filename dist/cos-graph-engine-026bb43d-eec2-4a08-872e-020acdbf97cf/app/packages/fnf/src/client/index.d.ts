import type { JobEntry } from '../define-job';
import type { AdjustKind } from '../normalize';
import type { Generation } from '../types';
import type { AdjustResult } from './adjust';
import type { ClientConfig } from './context';
import type { CostEstimate } from './cost';
import type { ListOptions, ListResult } from './list';
import type { PollOptions } from './poll';
import type { SafeSubmitResult, SubmitResult } from './submit';
import type { SubmitInputFor } from './submit-input';
import type { WaitOptions } from './wait';
export interface JobClient<Jobs extends readonly JobEntry[] = readonly JobEntry[]> {
    submit: (input: SubmitInputFor<Jobs>) => Promise<SubmitResult>;
    safeSubmit: (input: SubmitInputFor<Jobs>) => Promise<SafeSubmitResult>;
    /**
     * Opt-in client-side normalization: snap the requested setting kinds to their
     * nearest allowed values, returning a new input + the changes. Submit does not.
     */
    adjust: (input: SubmitInputFor<Jobs>, kinds: readonly AdjustKind[]) => AdjustResult<SubmitInputFor<Jobs>>;
    get: (id: string) => Promise<Generation>;
    /** All jobs of one job set in a single request (requires adapter `getJobSet` support — typed `not_supported` otherwise). */
    getSet: (jobSetId: string) => Promise<Generation[]>;
    poll: (id: string, opts?: Pick<PollOptions, 'signal' | 'onProgress'>) => Promise<Generation>;
    wait: (generations: Generation[], opts?: WaitOptions) => Promise<Generation[]>;
    /** Cancel a job server-side (requires adapter `cancelJob` support). */
    cancel: (id: string) => Promise<void>;
    list: (opts?: ListOptions) => Promise<ListResult>;
    cost: (input: SubmitInputFor<Jobs>) => Promise<CostEstimate>;
}
/**
 * Compose the job operations into a client. This is sugar over the free
 * functions — every method just binds the shared context. If you only need one
 * capability, build a context and call the operation directly:
 *
 *   const ctx = createContext(config)
 *   await submit(ctx, input)
 *
 * Media is a separate concern: use `createMediaClient` (it bundles
 * independently, so a jobs-only frontend never pulls the media code).
 */
export declare function createJobClient<const Jobs extends readonly JobEntry[]>(config: ClientConfig<Jobs>): JobClient<Jobs>;
export type { JobEntry } from '../define-job';
export type { AdjustKind, Adjustment } from '../normalize';
export { getJobPhase, getMediaType, getPreviewUrl, getRawUrl, hasResult, isCompleted, isFailed, isFailedJobStatus, isFromJob, isGenerating, isTerminalJobStatus } from '../selectors';
export type { JobPhase } from '../selectors';
export type { Generation, GenerationInput, GenerationResults, GenerationStatus, MediaInput, MediaRef, OutputType, PromptInput } from '../types';
export { adjust } from './adjust';
export type { AdjustResult } from './adjust';
export { cancelGeneration } from './cancel';
export { createContext, entryFor } from './context';
export type { ClientConfig, GenerationContext } from './context';
export { estimateCost } from './cost';
export type { CostEstimate } from './cost';
export { getGeneration } from './get';
export { getJobSetGenerations } from './get-set';
export { listGenerations } from './list';
export type { ListOptions, ListResult } from './list';
export { pollGeneration, pollJobSetGroup } from './poll';
export type { PollOptions } from './poll';
export { generationsFromBody, safeSubmit, submit } from './submit';
export type { SafeSubmitResult, SubmitResult } from './submit';
export type { BaseSubmitFields, SubmitInputFor } from './submit-input';
export { waitGenerations } from './wait';
export type { WaitOptions } from './wait';
//# sourceMappingURL=index.d.ts.map