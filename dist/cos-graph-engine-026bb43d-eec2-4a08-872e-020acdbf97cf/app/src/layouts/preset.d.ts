/**
 * Preset tile orientation — chosen per app. `horizontal` is the default
 * landscape (16:9) gallery; `vertical` renders portrait (9:16) tiles in a
 * denser grid (Figma vertical presets, node 3322:53945).
 */
export type PresetOrientation = 'horizontal' | 'vertical';
export interface PresetTemplateProps {
    /**
     * Preset tile orientation — landscape `horizontal` (default) or `vertical`
     * (portrait). Set it per app: `<PresetTemplate presetOrientation="vertical" />`.
     */
    presetOrientation?: PresetOrientation;
}
export declare function PresetTemplate({ presetOrientation }?: PresetTemplateProps): any;
//# sourceMappingURL=preset.d.ts.map