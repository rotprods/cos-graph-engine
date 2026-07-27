"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetLibraryModal = AssetLibraryModal;
const react_1 = require("react");
const search_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/search.svg?react"));
const add_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/add.svg?react"));
const avatar_1 = require("@higgsfield/quanta/avatar");
const button_1 = require("@higgsfield/quanta/button");
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const modal_1 = require("@higgsfield/quanta/modal");
const tabs_1 = require("@higgsfield/quanta/tabs");
const typography_1 = require("@higgsfield/quanta/typography");
/**
 * Asset Library modal — Figma SC App Builder "Share Modal" (node 2125:15262).
 * THE app-wide asset picker: EVERY "+" / upload / attach / add-media action in
 * every app opens this modal (never a custom picker). A glass modal with a tab
 * menu header (Uploads / Image Generations / …), a segmented "All | Personal"
 * toolbar with Search, and a 5-col element grid (New Element tile + media
 * cards). Quanta components + tokens only.
 *
 *   <AssetLibraryModal
 *     onSelect={item => setImage(item.src)}
 *     trigger={<Dropzone render={<button type="button" />} … />}
 *   />
 *
 * IMPORTANT: `trigger` is rendered AS the modal trigger (Base UI `render`
 * prop), so the element MUST spread incoming props (`onClick`, `ref`, aria)
 * onto a real DOM node — Quanta components and `@/components/*` all do. A
 * custom component that drops unknown props will silently not open the modal;
 * wrap it in a plain `<button type="button">` if needed. See
 * `@/components/AGENTS.md` for the full wiring contract.
 */
const THUMBS = [
    '/presets/how-product-works.png',
    '/presets/explain.png',
    '/presets/hyper-motion.png',
    '/presets/cover.png',
];
const HEADER_TABS = [
    { value: 'uploads', label: 'Uploads' },
    { value: 'image', label: 'Image Generations' },
    { value: 'video', label: 'Video Generations' },
    { value: 'liked', label: 'Liked' },
];
const ELEMENTS = [
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[0], badge: 'T', badgeColor: 'pink' },
    { name: '@Ultraviolet', type: 'Character', src: THUMBS[1], badge: 'C', badgeColor: 'mint' },
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[2] },
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[3] },
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[2], badge: 'G', badgeColor: 'mint' },
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[1], badge: 'A', badgeColor: 'blue' },
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[0] },
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[0] },
    { name: '@Ultraviolet', type: 'Location', src: THUMBS[0] },
];
/* ── Toolbar ────────────────────────────────────────────────────────────────── */
function AssetToolbar() {
    return (<div className="flex shrink-0 items-center gap-2 bg-q-transparent-light-05 p-2">
      <div className="flex flex-1 items-center gap-2 px-1">
        <tabs_1.Tabs.Root variant="pill" defaultValue="all">
          <tabs_1.Tabs.List items={[
            { value: 'all', label: 'All' },
            { value: 'personal', label: 'Personal' },
        ]}/>
        </tabs_1.Tabs.Root>
      </div>
      <div className="flex items-center gap-1">
        <button_1.Button variant="tertiary" size="sm" start={<icon_1.Icon as={search_svg_react_1.default} size="sm"/>}>
          Search
        </button_1.Button>
      </div>
    </div>);
}
/* ── Grid ───────────────────────────────────────────────────────────────────── */
function NewElementCard({ onSelect }) {
    const inputRef = (0, react_1.useRef)(null);
    // Hidden dismiss trigger so a picked file closes the modal via the SAME
    // Base UI Close path the grid cards use (we can't click the visible tile
    // to close because the file dialog resolves asynchronously in `onChange`).
    const closeRef = (0, react_1.useRef)(null);
    const handleChange = (event) => {
        const file = event.target.files?.[0];
        if (file != null) {
            onSelect?.({ name: file.name, type: file.type || 'Upload', src: URL.createObjectURL(file) });
            closeRef.current?.click();
        }
        // Reset so picking the same file again still fires `onChange`.
        event.target.value = '';
    };
    return (<>
      <button type="button" onClick={() => inputRef.current?.click()} className="flex flex-col items-center gap-1.5 rounded-q-400 p-1">
        <div className="flex h-24 w-full items-center justify-center rounded-q-300 border border-q-border-subtle bg-q-transparent-light-05">
          <span className="flex size-10 items-center justify-center rounded-q-full bg-q-transparent-light-05 shadow-q-raised-sm">
            <icon_1.Icon as={add_svg_react_1.default} size="md" color="primary"/>
          </span>
        </div>
        <div className="px-1 py-0.5">
          <typography_1.Typography as="span" variant="caption-sm-semi-bold" color="primary">
            Upload
          </typography_1.Typography>
        </div>
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleChange}/>
      <modal_1.Modal.Close ref={closeRef} aria-hidden tabIndex={-1} className="hidden"/>
    </>);
}
function ElementCard({ name, type, src, badge, badgeColor, onSelect }) {
    const className = 'flex flex-col gap-1.5 rounded-q-400 p-1 text-left transition-colors hover:bg-q-transparent-light-05';
    const children = (<>
      <media_1.Media ratio="auto" rounded="md" className="h-24 w-full">
        <media_1.Media.Image src={src} alt={name}/>
        {badge != null
            ? (<span className="absolute bottom-1.5 left-1.5 z-10">
                <avatar_1.Avatar size="xxs" color={badgeColor} alt={badge}/>
              </span>)
            : null}
      </media_1.Media>
      <div className="flex flex-col gap-0.5 px-1 py-0.5">
        <typography_1.Typography as="span" variant="caption-sm-semi-bold" color="primary" truncate>
          {name}
        </typography_1.Typography>
        <typography_1.Typography as="span" variant="caption-sm-regular" color="secondary" truncate>
          {type}
        </typography_1.Typography>
      </div>
    </>);
    // With an `onSelect`, picking a card closes the modal and reports the choice;
    // without one it stays a passive tile (the original gallery behaviour).
    return onSelect != null
        ? (<modal_1.Modal.Close className={className} onClick={() => onSelect({ name, type, src })}>
          {children}
        </modal_1.Modal.Close>)
        : (<button type="button" className={className}>
          {children}
        </button>);
}
function AssetGrid({ onSelect }) {
    return (<div className="min-h-0 flex-1 overflow-y-auto bg-q-transparent-light-05 p-2">
      <div className="grid grid-cols-5 gap-3">
        <NewElementCard onSelect={onSelect}/>
        {ELEMENTS.map((item, index) => (<ElementCard key={`${item.name}-${index}`} {...item} onSelect={onSelect}/>))}
      </div>
    </div>);
}
function AssetLibraryModal({ trigger, onSelect }) {
    return (<modal_1.Modal.Root>
      <modal_1.Modal.Trigger render={trigger}/>
      <modal_1.Modal.Content size="xl">
        <modal_1.Modal.Header flush className="px-2 py-1">
          <tabs_1.Tabs.Root variant="pill" defaultValue="uploads" className="flex-1">
            <tabs_1.Tabs.List items={HEADER_TABS}/>
          </tabs_1.Tabs.Root>
          <modal_1.Modal.CloseButton />
        </modal_1.Modal.Header>

        <div className="flex h-[595px] flex-col gap-px overflow-clip rounded-q-400">
          <AssetToolbar />
          <AssetGrid onSelect={onSelect}/>
        </div>
      </modal_1.Modal.Content>
    </modal_1.Modal.Root>);
}
//# sourceMappingURL=asset-library.js.map