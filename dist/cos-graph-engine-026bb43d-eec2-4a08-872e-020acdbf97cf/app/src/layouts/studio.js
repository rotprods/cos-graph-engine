"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioTemplate = StudioTemplate;
const react_1 = require("react");
const deployed_code_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/deployed_code.svg?react"));
const format_color_fill_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/format_color_fill.svg?react"));
const link_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/link.svg?react"));
const keyboard_arrow_down_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?react"));
const diamond_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/diamond.svg?react"));
const home_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/home.svg?react"));
const photo_library_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/photo_library.svg?react"));
const auto_awesome_mosaic_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/auto_awesome_mosaic.svg?react"));
const group_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/group.svg?react"));
const add_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/add.svg?react"));
const tune_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/tune.svg?react"));
const left_panel_close_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/left_panel_close.svg?react"));
const star_shine_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/star_shine.svg?react"));
const music_note_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/music_note.svg?react"));
const public_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/public.svg?react"));
const icon_1 = require("@higgsfield/quanta/icon");
const icon_tile_1 = require("@/components/icon-tile");
const media_1 = require("@higgsfield/quanta/media");
const prompt_box_1 = require("@/components/prompt-box");
const select_1 = require("@higgsfield/quanta/select");
const sidebar_1 = require("@higgsfield/quanta/sidebar");
const tabs_1 = require("@higgsfield/quanta/tabs");
const typography_1 = require("@higgsfield/quanta/typography");
const asset_library_1 = require("@/components/asset-library");
const template_picker_1 = require("@/components/template-picker");
/**
 * "Marketing Studio" screen template — Figma Marketing-Studio (node 7137:108784,
 * before-generation) and Cinema-Studio-V4 (node 21768:60756, after-generation).
 *
 * A product navigation rail (Quanta `Sidebar`) beside a canvas that switches
 * between two states:
 *   • before — a centered marketing hero + the `PromptBox` dock (the NEW Quanta
 *     component) whose settings all open as dropdowns (`Select` + `size="picker"`),
 *     over a 2-column gallery of `TemplateCard`s.
 *   • after  — the generated media grid with the same `StudioPromptBox` on the
 *     glass surface, floating in a dock pinned to the bottom.
 *
 * The prompt box's settings-slider control opens the full `TemplatePickerModal`.
 * A small top-right switch flips between the two states for preview. Quanta
 * components + tokens only.
 */
const COVERS = [
    '/presets/how-product-works.png',
    '/presets/explain.png',
    '/presets/hyper-motion.png',
    '/presets/cover.png',
];
/* ── Prompt-box setting dropdowns (the "all settings open as dropdowns" rule) ── */
const PICKER_POPUP = {
    size: 'picker',
    surface: 'solid',
    side: 'bottom',
    align: 'start',
    sideOffset: 8,
    collisionPadding: 16,
};
const FORMATS = [
    { value: 'ugc', title: 'UGC', subtitle: 'Creator-style, handheld' },
    { value: 'tiktok', title: 'TikTok', subtitle: 'Fast-cut vertical' },
    { value: 'reels', title: 'Reels', subtitle: 'Instagram vertical' },
    { value: 'commercial', title: 'Commercial', subtitle: 'Polished brand film' },
];
const HOOKS = [
    { value: 'hook', title: 'Hook' },
    { value: 'story', title: 'Story' },
    { value: 'demo', title: 'Product demo' },
    { value: 'testimonial', title: 'Testimonial' },
];
/** A prompt-box pill that opens a compact builder picker (Select, size="picker"). */
function PillSelect({ defaultValue, options, start, hidden = false, }) {
    if (hidden)
        return null;
    return (<select_1.Select.Root defaultValue={defaultValue}>
      <select_1.Select.Trigger bare render={(<prompt_box_1.PromptBox.Pill start={start} end={<icon_1.Icon as={keyboard_arrow_down_svg_react_1.default} size="sm"/>}/>)}>
        <select_1.Select.Value>
          {(value) => options.find(option => option.value === value)?.title ?? value}
        </select_1.Select.Value>
      </select_1.Select.Trigger>
      <select_1.Select.Content {...PICKER_POPUP}>
        {options.map(option => (<select_1.Select.Item key={option.value} value={option.value}>
            {option.subtitle != null
                ? (<select_1.Select.ItemContent>
                    <select_1.Select.ItemText>{option.title}</select_1.Select.ItemText>
                    <select_1.Select.ItemDescription>{option.subtitle}</select_1.Select.ItemDescription>
                  </select_1.Select.ItemContent>)
                : <select_1.Select.ItemText>{option.title}</select_1.Select.ItemText>}
            <select_1.Select.ItemIndicator />
          </select_1.Select.Item>))}
      </select_1.Select.Content>
    </select_1.Select.Root>);
}
/* ── Sidebar (shared by both states) ───────────────────────────────────────── */
function StudioSidebar() {
    return (<sidebar_1.Sidebar.Root product="marketing-studio" flush>
      <sidebar_1.Sidebar.Header>
        <sidebar_1.Sidebar.Switcher>
          <sidebar_1.Sidebar.Logo>
            <span className="flex size-6 items-center justify-center rounded-q-200 bg-q-brand-primary text-q-text-inverse">
              <icon_1.Icon as={star_shine_svg_react_1.default} size="sm"/>
            </span>
          </sidebar_1.Sidebar.Logo>
          <sidebar_1.Sidebar.Title>Marketing Studio</sidebar_1.Sidebar.Title>
        </sidebar_1.Sidebar.Switcher>
        <sidebar_1.Sidebar.Toggle><icon_1.Icon as={left_panel_close_svg_react_1.default} size="md"/></sidebar_1.Sidebar.Toggle>
      </sidebar_1.Sidebar.Header>

      <sidebar_1.Sidebar.Body>
        <sidebar_1.Sidebar.Section>
          <sidebar_1.Sidebar.SectionItems>
            <sidebar_1.Sidebar.Item selected start={<icon_tile_1.IconTile as={home_svg_react_1.default} gradient="blue"/>} title="Home"/>
            <sidebar_1.Sidebar.Item start={<icon_tile_1.IconTile as={photo_library_svg_react_1.default} gradient="teal"/>} title="All Generations"/>
          </sidebar_1.Sidebar.SectionItems>
        </sidebar_1.Sidebar.Section>

        <sidebar_1.Sidebar.Section>
          <sidebar_1.Sidebar.SectionHeader>
            <sidebar_1.Sidebar.SectionTitle>Tools</sidebar_1.Sidebar.SectionTitle>
          </sidebar_1.Sidebar.SectionHeader>
          <sidebar_1.Sidebar.SectionItems>
            <sidebar_1.Sidebar.Item start={<icon_tile_1.IconTile as={link_svg_react_1.default} gradient="blue"/>} title="Url to Ad"/>
            <sidebar_1.Sidebar.Item start={<icon_tile_1.IconTile as={auto_awesome_mosaic_svg_react_1.default} gradient="teal"/>} title="Ad Reference"/>
            <sidebar_1.Sidebar.Item start={<icon_tile_1.IconTile as={music_note_svg_react_1.default} gradient="blue"/>} title="Manage TikTok"/>
          </sidebar_1.Sidebar.SectionItems>
        </sidebar_1.Sidebar.Section>

        <sidebar_1.Sidebar.Section>
          <sidebar_1.Sidebar.SectionHeader>
            <sidebar_1.Sidebar.SectionTitle>Projects</sidebar_1.Sidebar.SectionTitle>
            <sidebar_1.Sidebar.SectionActions>
              <sidebar_1.Sidebar.ActionButton aria-label="New project"><icon_1.Icon as={add_svg_react_1.default} size="md"/></sidebar_1.Sidebar.ActionButton>
            </sidebar_1.Sidebar.SectionActions>
          </sidebar_1.Sidebar.SectionHeader>
          <sidebar_1.Sidebar.SectionItems>
            <sidebar_1.Sidebar.Item variant="project" start={<sidebar_1.Sidebar.ProjectThumbnail src={COVERS[0]}/>} title="Aurora Labs" meta="221"/>
            <sidebar_1.Sidebar.Item variant="project" start={<sidebar_1.Sidebar.ProjectThumbnail src={COVERS[1]}/>} title="Pixel Forge" meta="18" onPinChange={() => { }} pinned/>
            <sidebar_1.Sidebar.Item variant="project" start={<sidebar_1.Sidebar.ProjectThumbnail src={COVERS[2]}/>} title="Blue Horizon" meta="484"/>
            <sidebar_1.Sidebar.Item variant="project" start={<sidebar_1.Sidebar.ProjectThumbnail src={COVERS[3]}/>} title="Nova" meta="156"/>
            <sidebar_1.Sidebar.Item variant="project" start={<sidebar_1.Sidebar.ProjectThumbnail src={COVERS[0]}/>} title="Motion Studio" meta="44"/>
            <sidebar_1.Sidebar.Item variant="project" start={<sidebar_1.Sidebar.ProjectThumbnail src={COVERS[1]}/>} title="Alpha" meta="449"/>
            <sidebar_1.Sidebar.Item variant="project" start={<sidebar_1.Sidebar.ProjectThumbnail src={COVERS[2]}/>} title="Quantum Works" meta="1 234"/>
          </sidebar_1.Sidebar.SectionItems>
        </sidebar_1.Sidebar.Section>
      </sidebar_1.Sidebar.Body>

      <sidebar_1.Sidebar.Footer>
        <sidebar_1.Sidebar.FooterItem variant="promo" start={<icon_1.Icon as={diamond_svg_react_1.default} size="md"/>} title="Pricing" end={<sidebar_1.Sidebar.PromoBadge />}/>
        <sidebar_1.Sidebar.FooterItem variant="login" start={<icon_1.Icon as={group_svg_react_1.default} size="md"/>} title="Login"/>
      </sidebar_1.Sidebar.Footer>
    </sidebar_1.Sidebar.Root>);
}
/**
 * Studio prompt dock (Figma Marketing-Studio 7259:51362) — a configured
 * composition of the Quanta `PromptBox` parts. Every region is prop-driven and
 * optional: the Product/App toggle, each reference tile, and each inline setting
 * can be switched off independently. Defaults render the full before-state.
 */
function StudioPromptBox({ showModeToggle = true, showProductTile = true, showAvatarTile = true, settings, surface, className = 'w-[830px] max-w-full', } = {}) {
    const { add = true, format = true, hook = true, tune = true } = settings ?? {};
    const [mode, setMode] = (0, react_1.useState)('product');
    return (<prompt_box_1.PromptBox.Root surface={surface} className={className}>
      <prompt_box_1.PromptBox.ModeRail hidden={!showModeToggle}>
        <prompt_box_1.PromptBox.Mode active={mode === 'product'} onClick={() => setMode('product')} start={<icon_1.Icon as={deployed_code_svg_react_1.default} size="md"/>}>Product</prompt_box_1.PromptBox.Mode>
        <prompt_box_1.PromptBox.Mode active={mode === 'app'} onClick={() => setMode('app')} start={<icon_1.Icon as={public_svg_react_1.default} size="md"/>}>App</prompt_box_1.PromptBox.Mode>
      </prompt_box_1.PromptBox.ModeRail>

      <prompt_box_1.PromptBox.Body>
        <prompt_box_1.PromptBox.Field placeholder="Describe the scene you imagine..." aria-label="Describe the scene you imagine"/>
        <prompt_box_1.PromptBox.Actions>
          {add
            ? (<asset_library_1.AssetLibraryModal trigger={(<prompt_box_1.PromptBox.Pill iconOnly aria-label="Add media" start={<icon_1.Icon as={add_svg_react_1.default} size="sm"/>}/>)}/>)
            : null}
          <PillSelect hidden={!format} start={<icon_1.Icon as={format_color_fill_svg_react_1.default} size="sm"/>} defaultValue="ugc" options={FORMATS}/>
          <PillSelect hidden={!hook} start={<icon_1.Icon as={format_color_fill_svg_react_1.default} size="sm"/>} defaultValue="hook" options={HOOKS}/>
          {tune
            ? (<template_picker_1.TemplatePickerModal trigger={(<prompt_box_1.PromptBox.Pill iconOnly aria-label="Template settings" start={<icon_1.Icon as={tune_svg_react_1.default} size="sm"/>}/>)}/>)
            : null}
        </prompt_box_1.PromptBox.Actions>
      </prompt_box_1.PromptBox.Body>

      <prompt_box_1.PromptBox.Uploads hidden={!showProductTile && !showAvatarTile}>
        <prompt_box_1.PromptBox.Upload hidden={!showProductTile} label="Product"/>
        <prompt_box_1.PromptBox.Upload hidden={!showAvatarTile} label="Avatar"/>
      </prompt_box_1.PromptBox.Uploads>

      <prompt_box_1.PromptBox.Generate cost={3} oldCost={12}/>
    </prompt_box_1.PromptBox.Root>);
}
const HERO_GLOW = 'radial-gradient(60% 80% at 50% 0%, rgba(209,254,23,0.10) 0%, rgba(209,254,23,0.03) 40%, transparent 70%)';
const GALLERY_TABS = [
    { value: 'all', label: 'All' },
    { value: 'tiktok', label: 'TikTok', start: <icon_1.Icon size="sm" as={music_note_svg_react_1.default}/> },
    { value: 'ugc', label: 'UGC' },
    { value: 'commercial', label: 'Commercial' },
];
/** Before-generation canvas: hero → prompt box → template gallery. */
function BeforeState() {
    return (<div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[600px]" style={{ backgroundImage: HERO_GLOW }}/>

      <div className="relative flex w-full flex-col items-center gap-12 px-6 pb-16 pt-16">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <typography_1.Typography as="span" variant="accent-xs-bold" color="secondary" className="text-[1rem]! leading-[1.25rem]! uppercase opacity-60">
              Marketing Studio
            </typography_1.Typography>
            <typography_1.Typography as="h1" variant="headline-lg-bold" color="primary" className="max-w-[420px] text-center uppercase">
              Turn any product into a video ad
            </typography_1.Typography>
          </div>
          <StudioPromptBox />
        </div>

        <div className="flex w-full max-w-[900px] flex-col items-center gap-5">
          <tabs_1.Tabs.Root variant="pill" defaultValue="all">
            <tabs_1.Tabs.List items={GALLERY_TABS}/>
          </tabs_1.Tabs.Root>
          <div className="grid w-full grid-cols-2 gap-5">
            {template_picker_1.TEMPLATES.map(template => (<template_picker_1.TemplateCard key={template.id} template={template}/>))}
          </div>
        </div>
      </div>
    </div>);
}
/* ── After-generation state (Cinema Studio V4) ─────────────────────────────── */
const RESULTS = [
    { src: COVERS[3], alt: 'Portrait in a corridor', ratio: 3 / 4 },
    { src: COVERS[0], alt: 'Street at dusk', ratio: 3 / 4 },
    { src: COVERS[1], alt: 'Concrete stairwell', ratio: 3 / 4 },
    { src: COVERS[2], alt: 'Neon portrait', ratio: 3 / 4 },
    { src: COVERS[3], alt: 'Studio portrait', ratio: 3 / 4 },
    { src: COVERS[1], alt: 'Waterfront', ratio: 3 / 4 },
    { src: COVERS[2], alt: 'Iced coffees', ratio: 3 / 4 },
    { src: COVERS[0], alt: 'Fur hat portrait', ratio: 3 / 4 },
    { src: COVERS[3], alt: 'Window light', ratio: 3 / 4 },
    { src: COVERS[1], alt: 'Cyclist in a suit', ratio: 3 / 4 },
];
/**
 * The floating bottom-center generation dock — the SAME `StudioPromptBox` as
 * the before-state (mode rail, prompt field, add/format/hook/tune pills,
 * upload tiles, Generate), on the glass surface, pinned to the bottom.
 */
function AfterPromptDock() {
    return (<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
      <StudioPromptBox surface="glass" className="pointer-events-auto w-[900px] max-w-full border-none"/>
    </div>);
}
const AFTER_TABS = [
    { value: 'history', label: 'History', start: <icon_1.Icon size="sm" as={photo_library_svg_react_1.default}/> },
    { value: 'community', label: 'Community', start: <icon_1.Icon size="sm" as={public_svg_react_1.default}/> },
];
function AfterState() {
    return (<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between p-4">
        <tabs_1.Tabs.Root variant="pill" defaultValue="history">
          <tabs_1.Tabs.List items={AFTER_TABS}/>
        </tabs_1.Tabs.Root>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-40">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {RESULTS.map((item, index) => (<media_1.Media key={index} ratio={item.ratio} rounded="md" className="w-full">
              <media_1.Media.Image src={item.src} alt={item.alt}/>
            </media_1.Media>))}
        </div>
      </div>

      <AfterPromptDock />
    </div>);
}
const STATE_TABS = [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
];
/** Fixed top-right switch to preview both Studio states without extra routing. */
function StateSwitch({ value, onChange }) {
    return (<div className="fixed right-4 top-3 z-50">
      <tabs_1.Tabs.Root variant="segmented" value={value} onValueChange={v => onChange(v)}>
        <tabs_1.Tabs.List items={STATE_TABS}/>
      </tabs_1.Tabs.Root>
    </div>);
}
function StudioTemplate({ state }) {
    const [internal, setInternal] = (0, react_1.useState)('before');
    const active = state ?? internal;
    const canvas = active === 'before' ? <BeforeState /> : <AfterState />;
    return (<div className="flex h-dvh overflow-hidden bg-q-background-primary">
      <StudioSidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {canvas}
      </main>
      {state == null ? <StateSwitch value={active} onChange={setInternal}/> : null}
    </div>);
}
//# sourceMappingURL=studio.js.map