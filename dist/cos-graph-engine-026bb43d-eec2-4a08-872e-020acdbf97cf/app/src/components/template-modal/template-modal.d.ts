import type { ReactElement, ReactNode } from 'react';
/**
 * TemplateModal — the "All Presets" picker (Figma SC App Builder, node
 * 3117:143969). A glass `Modal` whose body is a plain grid of selectable option
 * tiles: each a preview image with a label underneath, the active one ringed by
 * the lime brand border. Distinct from the Studio `TemplatePickerModal` (which
 * is a tabbed/searchable gallery of triptych cards) — this is the generic
 * "choose a template / preset / animal / option set" chooser, so any trigger
 * that implies picking one option from a set can reuse it via `trigger`, exactly
 * like `AssetLibraryModal`.
 *
 *   <TemplateModal
 *     title="Select Animal"
 *     options={ANIMALS}
 *     defaultValue="deer"
 *     onSelect={handleSelect}
 *     trigger={<Dropzone render={<button type="button" />} … />}
 *   />
 *
 * Quanta components + `q-` tokens only.
 */
export interface TemplateOption {
    /** Stable id used for selection + React keys. */
    id: string;
    /** Label shown beneath the preview. */
    label: string;
    /** Preview image source. */
    image: string;
    /** Alt text for the preview (defaults to `label`). */
    alt?: string;
}
declare const COLUMN_CLASS: {
    readonly 2: "grid-cols-2";
    readonly 3: "grid-cols-3";
    readonly 4: "grid-cols-4";
    readonly 5: "grid-cols-5";
};
export type TemplateModalColumns = keyof typeof COLUMN_CLASS;
export interface TemplateModalProps {
    /** The trigger element (e.g. a `Dropzone`/button). Rendered as the Modal trigger. */
    trigger: ReactElement;
    /** Selectable option tiles. */
    options: TemplateOption[];
    /** Header title. */
    title?: ReactNode;
    /** Controlled selected id. */
    value?: string;
    /** Uncontrolled initial selected id. */
    defaultValue?: string;
    /** Fired when a tile is chosen. */
    onSelect?: (option: TemplateOption) => void;
    /** Grid columns (default 4, matching Figma). */
    columns?: TemplateModalColumns;
    /** Close the modal once an option is chosen (default true). */
    closeOnSelect?: boolean;
    /** Start opened (uncontrolled) — handy for previews. */
    defaultOpen?: boolean;
}
export declare function TemplateModal({ trigger, options, title, value, defaultValue, onSelect, columns, closeOnSelect, defaultOpen, }: TemplateModalProps): any;
export {};
//# sourceMappingURL=template-modal.d.ts.map