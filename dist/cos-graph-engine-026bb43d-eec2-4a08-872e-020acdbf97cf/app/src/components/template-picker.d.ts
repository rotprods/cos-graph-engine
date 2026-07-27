import type { ReactElement, ReactNode } from 'react';
import IconBatteryFullFilled from '@material-symbols/svg-400/outlined/battery_full.svg?react';
/** Branded lead-tile gradients (no Quanta gradient token — documented literals). */
declare const BADGE_GRADIENT: {
    readonly tiktok: "linear-gradient(135deg, rgb(45, 204, 211) 3.87%, rgb(241, 32, 74) 93.45%)";
    readonly blue: "linear-gradient(135deg, rgb(81, 180, 226) 3.87%, rgb(24, 64, 182) 93.45%)";
    readonly pink: "linear-gradient(135deg, rgb(226, 81, 180) 3.87%, rgb(141, 18, 55) 93.45%)";
};
type BadgeGradient = keyof typeof BADGE_GRADIENT;
type LeadGlyph = typeof IconBatteryFullFilled;
export type TemplateCategory = 'tiktok' | 'ugc' | 'commercial';
export type TemplateKind = 'image' | 'video';
export interface TemplateItem {
    id: string;
    title: string;
    subtitle: string;
    category: TemplateCategory;
    kind: TemplateKind;
    images: [string, string, string];
    icon: LeadGlyph;
    gradient: BadgeGradient;
}
export declare const TEMPLATES: TemplateItem[];
export interface TemplateCardProps {
    template: TemplateItem;
    /** Fired by the "Try" action (wire to seed the prompt box / start a generation). */
    onTry?: (template: TemplateItem) => void;
    /** Swap the "Try" label (e.g. "Use"). */
    tryLabel?: ReactNode;
}
/**
 * A single marketing template tile — Figma Marketing-Studio gallery card
 * (7137:108927): co-brand header, a rounded 3-shot triptych (video templates
 * carry a play badge), and a footer with a gradient category badge, the
 * title/subtitle, and the lime "Try" CTA.
 */
export declare function TemplateCard({ template, onTry, tryLabel }: TemplateCardProps): any;
export interface TemplatePickerModalProps {
    /** The trigger element (e.g. a PromptBox.Pill). Rendered as the Modal trigger. */
    trigger: ReactElement;
    /** Fired when a template's "Try" is clicked (wire to seed the prompt box). */
    onSelect?: (template: TemplateItem) => void;
    /** Start opened (uncontrolled) — handy for previews. */
    defaultOpen?: boolean;
}
export declare function TemplatePickerModal({ trigger, onSelect, defaultOpen }: TemplatePickerModalProps): any;
export {};
//# sourceMappingURL=template-picker.d.ts.map