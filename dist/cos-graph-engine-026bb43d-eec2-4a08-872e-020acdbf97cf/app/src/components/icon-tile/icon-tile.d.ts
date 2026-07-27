import type { ComponentPropsWithRef } from 'react';
import type { IconGlyph } from '@higgsfield/quanta/icon';
/**
 * IconTile — a 24px leading tile with a glyph centered inside a box, for
 * navigation / list rows (Figma SC App Builder "Share Modal" leading tile
 * "Left_lg" 2125:15286, and the neutral "New folder" tile 2125:15346). Two
 * looks share the same footprint (`space/600`, `radius/200`):
 *
 *   <IconTile as={AtIcon} gradient="blue" />          // colored brand tile
 *   <IconTile as={FolderIcon} />                      // neutral white-5% tile
 *
 * The `gradient` look is a colored box (hairline light border + drop/inset
 * sheen + two blended white sheens) with a WHITE glyph; omit `gradient` for the
 * neutral raised box with a `secondary` glyph. The gradient STOPS + sheens are
 * the one necessary literal — these branded fills have no Quanta token; the
 * size / radius / neutral surface all come from tokens.
 *
 * Pass a brand preset (`'blue'` | `'teal'`) or any CSS gradient string. The tile
 * is a passive `<span>`; spread `aria-*` / `className` as needed — the glyph is
 * decorative, so the row label carries the meaning.
 */
export type IconTileGradient = 'blue' | 'teal';
/**
 * Brand gradient presets for the colored tile. The stops are bespoke branded
 * fills (no Quanta gradient token exists), kept here so every surface that uses
 * a colored icon tile shares the exact same fills.
 */
export declare const ICON_TILE_GRADIENT: Record<IconTileGradient, string>;
export type IconTileProps = ComponentPropsWithRef<'span'> & {
    /** Glyph painted at 16px (white on gradient, `secondary` on neutral). */
    as: IconGlyph;
    /**
     * Colored gradient backing — a brand preset (`'blue'` / `'teal'`) or any CSS
     * gradient string. Omit for the neutral (white-5% raised) tile.
     */
    gradient?: IconTileGradient | (string & {});
};
export declare function IconTile({ as, gradient, className, style, ...props }: IconTileProps): any;
//# sourceMappingURL=icon-tile.d.ts.map