"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATES = void 0;
exports.TemplateCard = TemplateCard;
exports.TemplatePickerModal = TemplatePickerModal;
const react_1 = require("react");
const token_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/token.svg?react"));
const attach_money_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/attach_money.svg?react"));
const wand_shine_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/wand_shine.svg?react"));
const battery_full_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/battery_full.svg?react"));
const calendar_month_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/calendar_month.svg?react"));
const home_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/home.svg?react"));
const search_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/search.svg?react"));
const play_arrow_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/play_arrow.svg?react"));
const music_note_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/music_note.svg?react"));
const videocam_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/videocam.svg?react"));
const button_1 = require("@higgsfield/quanta/button");
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const modal_1 = require("@higgsfield/quanta/modal");
const tabs_1 = require("@higgsfield/quanta/tabs");
const typography_1 = require("@higgsfield/quanta/typography");
/**
 * TemplatePickerModal — the full-screen "template settings" picker that opens
 * from the Studio prompt box (Figma Marketing-Studio: the settings/Templates
 * control on node 7259:51362 opens this). A glass `Modal` (spirit of the
 * asset-library modal) whose body is a gallery of selectable IMAGE / VIDEO
 * template tiles, filtered by category (All / TikTok / UGC / Commercial) and by
 * media type (All / Image / Video).
 *
 * ── Figma note ────────────────────────────────────────────────────────────────
 * The referenced node (7259:51362) resolves to the Studio *prompt box* itself;
 * Figma exposes no standalone "template modal" node. The tile design is taken
 * verbatim from the Studio gallery cards (node 7137:108927 — brand header,
 * rounded triptych, gradient badge + title/subtitle + lime "Try"), and lifted
 * into a Quanta glass Modal following the asset-library composition. The exported
 * `TemplateCard` + `TEMPLATES` are shared with `studio.tsx` so the in-page
 * gallery and the modal render identical tiles.
 */
const THUMBS = [
    '/presets/how-product-works.png',
    '/presets/explain.png',
    '/presets/hyper-motion.png',
    '/presets/cover.png',
];
/** Branded lead-tile gradients (no Quanta gradient token — documented literals). */
const BADGE_GRADIENT = {
    tiktok: 'linear-gradient(135deg, rgb(45, 204, 211) 3.87%, rgb(241, 32, 74) 93.45%)',
    blue: 'linear-gradient(135deg, rgb(81, 180, 226) 3.87%, rgb(24, 64, 182) 93.45%)',
    pink: 'linear-gradient(135deg, rgb(226, 81, 180) 3.87%, rgb(141, 18, 55) 93.45%)',
};
exports.TEMPLATES = [
    { id: 'ugc-gadget', title: 'UGC Gadget save me', subtitle: 'Turn long videos into short clips', category: 'ugc', kind: 'video', images: [THUMBS[0], THUMBS[1], THUMBS[2]], icon: battery_full_svg_react_1.default, gradient: 'tiktok' },
    { id: 'giant-figure', title: 'Giant figure', subtitle: 'Product hero, larger than life', category: 'tiktok', kind: 'image', images: [THUMBS[1], THUMBS[3], THUMBS[0]], icon: wand_shine_svg_react_1.default, gradient: 'tiktok' },
    { id: 'classic-modern', title: 'Classic meets modern', subtitle: 'Editorial style transfer', category: 'commercial', kind: 'image', images: [THUMBS[2], THUMBS[0], THUMBS[1]], icon: calendar_month_svg_react_1.default, gradient: 'blue' },
    { id: 'couple-home', title: 'Couple sharing home', subtitle: 'Lifestyle story in 3 shots', category: 'ugc', kind: 'video', images: [THUMBS[3], THUMBS[2], THUMBS[0]], icon: home_svg_react_1.default, gradient: 'pink' },
    { id: 'unbox-hype', title: 'Unboxing hype', subtitle: 'Fast-cut reveal for TikTok', category: 'tiktok', kind: 'video', images: [THUMBS[0], THUMBS[2], THUMBS[3]], icon: wand_shine_svg_react_1.default, gradient: 'tiktok' },
    { id: 'studio-lookbook', title: 'Studio lookbook', subtitle: 'Clean commercial catalogue', category: 'commercial', kind: 'image', images: [THUMBS[1], THUMBS[0], THUMBS[3]], icon: calendar_month_svg_react_1.default, gradient: 'blue' },
];
/** 24px branded gradient badge with a white glyph — the Studio card lead tile. */
function GradientBadge({ as, gradient }) {
    return (<span className="relative flex items-center justify-center overflow-hidden rounded-q-250 border border-[rgba(197,197,197,0.24)] p-q-200 text-white shadow-[0_4px_4px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.24)]">
      <span aria-hidden className="absolute inset-0" style={{ backgroundImage: BADGE_GRADIENT[gradient] }}/>
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 mix-blend-overlay"/>
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.32] mix-blend-hard-light"/>
      <icon_1.Icon as={as} size="md" className="relative"/>
    </span>);
}
const TRIPTYCH_CORNERS = [
    'rounded-tl-q-500 rounded-bl-q-500 rounded-tr-q-150 rounded-br-q-150',
    'rounded-q-150',
    'rounded-tr-q-500 rounded-br-q-500 rounded-tl-q-150 rounded-bl-q-150',
];
/**
 * A single marketing template tile — Figma Marketing-Studio gallery card
 * (7137:108927): co-brand header, a rounded 3-shot triptych (video templates
 * carry a play badge), and a footer with a gradient category badge, the
 * title/subtitle, and the lime "Try" CTA.
 */
function TemplateCard({ template, onTry, tryLabel = 'Try' }) {
    return (<div className="flex flex-col gap-q-200 rounded-q-600 bg-q-background-secondary p-q-200 shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
      <div className="flex h-60 items-stretch gap-1.5">
        {template.images.map((src, index) => (<media_1.Media key={index} ratio="auto" rounded="none" className={`min-w-0 flex-1 border border-q-border-subtle ${TRIPTYCH_CORNERS[index]}`}>
            <media_1.Media.Image src={src} alt={`${template.title} — shot ${index + 1}`}/>
            {template.kind === 'video' && index === 1
                ? (<media_1.Media.Overlay placement="center">
                    <span className="flex size-10 items-center justify-center rounded-q-full bg-q-transparent-dark-40 text-white backdrop-blur-sm">
                      <icon_1.Icon as={play_arrow_svg_react_1.default} size="md"/>
                    </span>
                  </media_1.Media.Overlay>)
                : null}
          </media_1.Media>))}
      </div>
      <div className="flex items-center gap-3 px-2 py-1">
        <GradientBadge as={template.icon} gradient={template.gradient}/>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <typography_1.Typography as="span" variant="label-md-medium" color="primary" truncate>
            {template.title}
          </typography_1.Typography>
          <typography_1.Typography as="span" variant="caption-sm-regular" color="secondary" truncate>
            {template.subtitle}
          </typography_1.Typography>
        </div>
        <button_1.Button variant="marketingPrimary" size="sm" onClick={() => onTry?.(template)}>
          {tryLabel}
        </button_1.Button>
      </div>
    </div>);
}
/* ── Filter tabs ──────────────────────────────────────────────────────────── */
const CATEGORY_TABS = [
    { value: 'all', label: 'All' },
    { value: 'tiktok', label: 'TikTok', start: <icon_1.Icon size="sm" as={music_note_svg_react_1.default}/> },
    { value: 'ugc', label: 'UGC', start: <icon_1.Icon size="sm" as={token_svg_react_1.default}/> },
    { value: 'commercial', label: 'Commercial', start: <icon_1.Icon size="sm" as={attach_money_svg_react_1.default}/> },
];
const TYPE_TABS = [
    { value: 'all', label: 'All' },
    { value: 'image', label: 'Image', start: <icon_1.Icon size="sm" as={wand_shine_svg_react_1.default}/> },
    { value: 'video', label: 'Video', start: <icon_1.Icon size="sm" as={videocam_svg_react_1.default}/> },
];
function TemplatePickerModal({ trigger, onSelect, defaultOpen }) {
    const [category, setCategory] = (0, react_1.useState)('all');
    const [kind, setKind] = (0, react_1.useState)('all');
    const visible = (0, react_1.useMemo)(() => exports.TEMPLATES.filter(t => (category === 'all' || t.category === category)
        && (kind === 'all' || t.kind === kind)), [category, kind]);
    return (<modal_1.Modal.Root defaultOpen={defaultOpen}>
      <modal_1.Modal.Trigger render={trigger}/>
      <modal_1.Modal.Content size="2xl">
        <modal_1.Modal.Header flush className="px-2 py-1">
          <tabs_1.Tabs.Root variant="pill" value={category} onValueChange={setCategory} className="flex-1">
            <tabs_1.Tabs.List items={CATEGORY_TABS}/>
          </tabs_1.Tabs.Root>
          <modal_1.Modal.CloseButton />
        </modal_1.Modal.Header>

        <div className="flex items-center justify-between gap-4 px-1 pb-3">
          <tabs_1.Tabs.Root variant="segmented" value={kind} onValueChange={setKind}>
            <tabs_1.Tabs.List items={TYPE_TABS}/>
          </tabs_1.Tabs.Root>
          <button_1.Button variant="tertiary" size="sm" start={<icon_1.Icon as={search_svg_react_1.default} size="sm"/>}>
            Search
          </button_1.Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-5 p-1">
            {visible.map(template => (<TemplateCard key={template.id} template={template} onTry={onSelect} tryLabel="Use"/>))}
          </div>
        </div>

        <modal_1.Modal.Footer>
          <modal_1.Modal.FooterCaption>
            {visible.length}
            {' '}
            template
            {visible.length === 1 ? '' : 's'}
          </modal_1.Modal.FooterCaption>
        </modal_1.Modal.Footer>
      </modal_1.Modal.Content>
    </modal_1.Modal.Root>);
}
//# sourceMappingURL=template-picker.js.map