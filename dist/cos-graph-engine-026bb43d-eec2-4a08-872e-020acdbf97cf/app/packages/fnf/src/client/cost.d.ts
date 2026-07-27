import type { GenerationInput } from '../types';
import type { GenerationContext } from './context';
export interface CostEstimate {
    credits: number;
}
export declare function estimateCost(ctx: GenerationContext, input: GenerationInput): Promise<CostEstimate>;
//# sourceMappingURL=cost.d.ts.map