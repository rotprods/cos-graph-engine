import type { CostEstimate, GenerationInput } from '@higgsfield/fnf/client';
import type { FnfScopeOptions } from './keys';
export interface CostQueryClient<Input = GenerationInput> {
    cost: (input: Input) => Promise<CostEstimate>;
}
export interface CostQueryOptions extends FnfScopeOptions {
    enabled?: boolean;
}
export declare function costQueryOptions<Input>(client: CostQueryClient<Input>, input: Input, opts?: CostQueryOptions): any;
//# sourceMappingURL=cost-query.d.ts.map