import type { ComponentProps } from 'react';
import { PromptBox } from '@/components/prompt-box';
/** Which inline setting controls the prompt box footer shows. */
export interface StudioPromptSettings {
    /** The "+" add-media pill. */
    add?: boolean;
    /** The UGC format dropdown. */
    format?: boolean;
    /** The Hook dropdown. */
    hook?: boolean;
    /** The sliders/settings pill (opens the template picker). */
    tune?: boolean;
}
export interface StudioPromptBoxProps {
    /** Show the Product/App generation-mode toggle rail. */
    showModeToggle?: boolean;
    /** Show the Product reference upload tile. */
    showProductTile?: boolean;
    /** Show the Avatar reference upload tile. */
    showAvatarTile?: boolean;
    /** Toggle individual inline setting controls (each defaults on). */
    settings?: StudioPromptSettings;
    /** PromptBox surface — `glass` for the floating after-state dock. */
    surface?: ComponentProps<typeof PromptBox.Root>['surface'];
    /** Root-pane classes (width / pointer-events); replaces the default width. */
    className?: string;
}
export type StudioState = 'before' | 'after';
export interface StudioTemplateProps {
    /** Which canvas to show. Uncontrolled preview switch drives it when omitted. */
    state?: StudioState;
}
export declare function StudioTemplate({ state }: StudioTemplateProps): any;
//# sourceMappingURL=studio.d.ts.map