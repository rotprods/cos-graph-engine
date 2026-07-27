import type { ReactElement, ReactNode } from 'react';
/**
 * StepRail — a horizontal numbered step indicator for short in-app wizards
 * (modeled on the Higgsfield "Shots" app header: `1 Upload — 2 Grid — 3
 * Upscale`). Quanta ships no stepper, so this composes Quanta primitives
 * (`Icon`, `Typography`) + `q-` tokens into the numbered-badge / connector row.
 *
 * It is IN-APP navigation, not an app header (the Higgsfield host owns the top
 * chrome): a row of numbered badges joined by connector lines. Completed steps
 * show a brand check, the current step a brand-filled number, upcoming steps a
 * muted number. Pass `reachable` to make already-unlocked steps clickable via
 * `onStepChange`; steps outside it render as disabled markers.
 *
 *   <StepRail
 *     steps={[{ id: 'upload', label: 'Upload' }, …]}
 *     current={step}
 *     reachable={['upload', 'grid']}
 *     onStepChange={setStep}
 *   />
 *
 * The host element is swappable via `render` (Base UI `useRender`) for semantics
 * like `<nav>`.
 */
export interface StepRailStep {
    /** Stable id used for selection + React keys. */
    id: string;
    /** Label shown beside the number badge. */
    label: ReactNode;
}
export interface StepRailProps {
    /** Ordered steps, left → right. */
    steps: StepRailStep[];
    /** The active step id. */
    current: string;
    /**
     * Ids the user may jump to (already unlocked). When set, only these steps are
     * clickable; the rest render as passive markers. Omit to make every step
     * clickable.
     */
    reachable?: string[];
    /** Fired when a reachable step is clicked. */
    onStepChange?: (id: string) => void;
    /** Swap the host element (defaults to a `<nav>`). */
    render?: ReactElement;
    className?: string;
}
export declare function StepRail({ steps, current, reachable, onStepChange, render, className, }: StepRailProps): any;
//# sourceMappingURL=step-rail.d.ts.map