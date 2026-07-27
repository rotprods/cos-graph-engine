import type { ComponentProps, ComponentPropsWithRef, ReactElement, ReactNode } from 'react';
/**
 * PromptBox — the Studio "prompt dock" (Figma Marketing-Studio node 7259:51362,
 * reused in the Cinema-Studio generation state 21768:60842). The horizontal
 * generation bar every Studio screen leads with: a vertical generation-MODE rail
 * (Product / App), then one shared right-side dock containing the prompt SURFACE
 * (a free-text area over a footer row of setting PILLS), a strip of reference
 * UPLOAD tiles (Product / Avatar), and the special GENERATE button.
 *
 * It is the counterpart to `Composer` (the tall side-rail prompt pane): where
 * Composer is a single vertical field, PromptBox is the wide multi-slot dock
 * that carries the mode rail, inline setting pickers, upload tiles, and the CTA.
 *
 * COMPOSITION-FIRST (same rules as Composer / Sidebar / Modal). The component
 * owns the DESIGN — the two-layer prompt surface, the pill/tile/mode shells, the
 * lime CTA — and every control is CONTENT you compose:
 *
 *   <PromptBox.Root>
 *     <PromptBox.ModeRail>
 *       <PromptBox.Mode active start={<CubeIcon />}>Product</PromptBox.Mode>
 *       <PromptBox.Mode start={<WorldIcon />}>App</PromptBox.Mode>
 *     </PromptBox.ModeRail>
 *
 *     <PromptBox.Body>
 *       <PromptBox.Field placeholder="Describe the scene you imagine…" />
 *       <PromptBox.Actions>
 *         <PromptBox.Pill iconOnly aria-label="Add" start={<PlusIcon />} />
 *         <PromptBox.Pill start={<Avatar/>} end={<ChevronIcon/>}>UGC</PromptBox.Pill>
 *         <PromptBox.Pill iconOnly aria-label="Settings" start={<SlidersIcon />} />
 *       </PromptBox.Actions>
 *     </PromptBox.Body>
 *
 *     <PromptBox.Uploads>
 *       <PromptBox.Upload label="Product" />
 *       <PromptBox.Upload label="Avatar" src={cover} />
 *     </PromptBox.Uploads>
 *
 *     <PromptBox.Generate cost={3} oldCost={12} />
 *   </PromptBox.Root>
 *
 * SETTINGS OPEN AS DROPDOWNS: a `PromptBox.Pill` is a bare `<button>` (or any
 * element via `render`), so it drops straight into a `Select`/`Dropdown` trigger
 * exactly like `SettingTrigger` — Base UI drives `data-popup-open` on the host:
 *
 *   <Select.Root defaultValue="ugc">
 *     <Select.Trigger bare render={<PromptBox.Pill start={<Avatar/>} end={<ChevronIcon/>} />}>
 *       <Select.Value />
 *     </Select.Trigger>
 *     <Select.Content size="picker">…</Select.Content>
 *   </Select.Root>
 *
 * `surface="glass"` skins the whole dock as a frosted floating bar (the
 * generation-state dock) instead of the plain, centered before-generation dock.
 *
 * EVERY SLOT IS OPTIONAL. Because the dock is composition-first, a caller shows a
 * subset simply by omitting parts — no part is required. For prop-driven UIs that
 * would rather keep the JSX and toggle a boolean, the optional parts (`ModeRail`,
 * `Mode`, `Pill`, `Uploads`, `Upload`) accept `hidden`: when `true` the part
 * unmounts (renders `null`) so the surrounding flex gaps collapse cleanly —
 * unlike the native `hidden` attribute, which would leave an empty box in flow.
 * This is how the Studio prompt box makes the Product/App toggle, the
 * Product/Avatar upload tiles, and each inline setting individually switchable.
 */
export type PromptBoxSurface = 'plain' | 'glass';
export type PromptBoxRootProps = ComponentProps<'div'> & {
    /** Dock skin: the plain centered dock (default) or the frosted floating bar. */
    surface?: PromptBoxSurface;
};
declare function Root({ surface, className, children: childrenProp, ...props }: PromptBoxRootProps): any;
export type PromptBoxModeRailProps = ComponentProps<'div'> & {
    /** Unmount the whole generation-mode toggle (renders `null`). */
    hidden?: boolean;
};
declare function ModeRail({ hidden, className, ...props }: PromptBoxModeRailProps): any;
export type PromptBoxModeProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
    /** Highlighted (selected) mode. */
    active?: boolean;
    /** Unmount this mode option (renders `null`). */
    hidden?: boolean;
    /** Leading glyph (any node) stacked above the label. */
    start?: ReactNode;
    /** Mode label. */
    children?: ReactNode;
    /** Swap the host element (e.g. a Tabs/Toggle trigger). Defaults to a `<button>`. */
    render?: ReactElement;
};
declare function Mode({ active, hidden, start, children, render, className, ref, ...props }: PromptBoxModeProps): any;
export type PromptBoxBodyProps = ComponentProps<'div'> & {
    /** Class for the inner white-5% surface that hosts the field + actions. */
    surfaceClassName?: string;
};
declare function Body({ className, surfaceClassName, children, ...props }: PromptBoxBodyProps): any;
export type PromptBoxFieldProps = Omit<ComponentProps<'textarea'>, 'children'>;
declare function Field({ className, rows, ...props }: PromptBoxFieldProps): any;
declare function Actions({ className, ...props }: ComponentProps<'div'>): any;
export type PromptBoxPillProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
    /** Leading slot — a 16px icon or `<Avatar>`. */
    start?: ReactNode;
    /** Trailing slot — typically a chevron for dropdown pills. */
    end?: ReactNode;
    /** Pill label. Omit with `iconOnly` for a square glyph button (+ / settings). */
    children?: ReactNode;
    /** Square icon-only pill (no label). */
    iconOnly?: boolean;
    /** Unmount this setting pill (renders `null`). */
    hidden?: boolean;
    /** Swap the host (e.g. `Select.Trigger`/`Dropdown.Trigger`). Defaults to `<button>`. */
    render?: ReactElement;
};
declare function Pill({ start, end, children, iconOnly, hidden, render, className, ref, ...props }: PromptBoxPillProps): any;
export type PromptBoxUploadsProps = ComponentProps<'div'> & {
    /** Unmount the whole reference-tile strip (renders `null`). */
    hidden?: boolean;
};
declare function Uploads({ hidden, className, ...props }: PromptBoxUploadsProps): any;
export type PromptBoxUploadProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
    /** Bottom label (e.g. "Product", "Avatar", "Character"). */
    label?: ReactNode;
    /** Filled-state image — when set the tile shows the picked reference. */
    src?: string;
    /** Alt text for the filled image. */
    alt?: string;
    /** Unmount this reference tile (renders `null`). */
    hidden?: boolean;
    /** The corner glyph (default a plus). Compose a Button/Avatar for a filled slot. */
    add?: ReactNode;
    /** Extra overlay content composed inside the tile. */
    children?: ReactNode;
    /** Swap the host element. Defaults to a `<button>`. */
    render?: ReactElement;
};
declare function Upload({ label, src, alt, hidden, add, children, render, className, ref, ...props }: PromptBoxUploadProps): any;
export type PromptBoxGenerateProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
    /** The credit cost shown beside the icon. */
    cost?: ReactNode;
    /** A struck-through original cost (promo pricing). */
    oldCost?: ReactNode;
    /** Leading glyph (defaults to the sparkles mark). */
    start?: ReactNode;
    /** Button label (defaults to "Generate"). */
    children?: ReactNode;
    /** Swap the host element. Defaults to a `<button>`. */
    render?: ReactElement;
};
declare function Generate({ cost, oldCost, start, children, render, className, ref, ...props }: PromptBoxGenerateProps): any;
export declare const PromptBox: {
    Root: typeof Root;
    ModeRail: typeof ModeRail;
    Mode: typeof Mode;
    Body: typeof Body;
    Field: typeof Field;
    Actions: typeof Actions;
    Pill: typeof Pill;
    Uploads: typeof Uploads;
    Upload: typeof Upload;
    Generate: typeof Generate;
};
export {};
//# sourceMappingURL=prompt-box.d.ts.map