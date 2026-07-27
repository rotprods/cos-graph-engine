/**
 * Shots app screen template — a faithful rebuild of the live Higgsfield "Shots"
 * app (https://higgsfield.ai/apps/shots) in our design system. The real page is
 * a compact, centered 3-step wizard — `Upload → Grid → Upscale` — that takes ONE
 * source image, generates 9 cinematic camera angles, lets the user favorite the
 * best ones, and upscales them to 4K ("Upload one image, get 9 cinematic angles.
 * Select your favorites and upscale to 4K.").
 *
 * Structure + flow are mapped onto Quanta components + our shared `@/components`:
 *   • The numbered wizard header → `StepRail` (a new shared component).
 *   • Step 1 (Upload) → a centered `Card` hero: a `Media` preview whose click
 *     (and the white "Upload image" button) open `AssetLibraryModal`, then a
 *     costed marketing Generate CTA.
 *   • Step 2 (Grid) → a `Grid` of `GenerationCard`s (`state="generating"` while
 *     the angles render, then selectable result tiles that open
 *     `GenerationDetailModal`).
 *   • Step 3 (Upscale) → a `BeforeAfterCompare` original↔4K hero over a grid of
 *     the upscaled favorites.
 *
 * Permanently dark, no app header (the host owns chrome), `q-` tokens only.
 */
type Step = 'upload' | 'grid' | 'upscale';
type RenderStage = 'idle' | 'generating' | 'ready';
export interface ShotsTemplateProps {
    /**
     * Optional seed to deep-link the wizard into a given state (also used by the
     * isolated previews). Every field is optional and defaults to the fresh
     * `upload` flow, so `<ShotsTemplate />` is unchanged.
     */
    preview?: {
        step?: Step;
        source?: string;
        gridStage?: RenderStage;
        upscaleStage?: RenderStage;
        /** Preselect the first N angle tiles as favorites. */
        selectedCount?: number;
    };
}
export declare function ShotsTemplate({ preview }?: ShotsTemplateProps): any;
export {};
//# sourceMappingURL=shots.d.ts.map