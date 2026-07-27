import type { ReactElement } from 'react';
/** A picked library element, reported by `AssetLibraryModal.onSelect`. */
export interface AssetSelection {
    name: string;
    type: string;
    src: string;
}
export interface AssetLibraryModalProps {
    /** The trigger element (e.g. a Composer.Action). Rendered as the Modal trigger. */
    trigger: ReactElement;
    /** Fired with the chosen element when a grid card is picked (closes the modal). */
    onSelect?: (item: AssetSelection) => void;
}
export declare function AssetLibraryModal({ trigger, onSelect }: AssetLibraryModalProps): any;
//# sourceMappingURL=asset-library.d.ts.map