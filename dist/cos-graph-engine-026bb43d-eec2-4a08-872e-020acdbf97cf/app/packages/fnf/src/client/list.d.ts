import type { Generation, GenerationStatus, OutputType } from '../types';
import type { GenerationContext } from './context';
export interface ListOptions {
    /** Generation kind bucket (the backend expands it into per-type sets). */
    type?: OutputType;
    /** Filter by terminal/progress statuses (repeatable). */
    status?: GenerationStatus | GenerationStatus[];
    /** Filter by model (`jobSetType`, repeatable). */
    model?: string | string[];
    cursor?: string | number;
    size?: number;
    /** List only the derived children of this job set (e.g. its upscales). */
    parentId?: string;
}
export interface ListResult {
    items: Generation[];
    cursor?: string | number;
}
export declare function listGenerations(ctx: GenerationContext, opts?: ListOptions): Promise<ListResult>;
//# sourceMappingURL=list.d.ts.map