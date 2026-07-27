"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresetTemplate = PresetTemplate;
const react_1 = require("react");
const link_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/link.svg?react"));
const folder_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/folder.svg?react"));
const auto_stories_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/auto_stories.svg?react"));
const image_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/image.svg?react"));
const search_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/search.svg?react"));
const newspaper_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/newspaper.svg?react"));
const edit_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/edit.svg?react"));
const add_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/add.svg?react"));
const icon_sparkles_soft_svg_react_1 = __importDefault(require("@/assets/icon-sparkles-soft.svg?react"));
const button_1 = require("@higgsfield/quanta/button");
const card_1 = require("@higgsfield/quanta/card");
const composer_1 = require("@/components/composer");
const grid_1 = require("@higgsfield/quanta/grid");
const icon_1 = require("@higgsfield/quanta/icon");
const input_1 = require("@higgsfield/quanta/input");
const media_1 = require("@higgsfield/quanta/media");
const media_card_1 = require("@/components/media-card");
const rail_footer_1 = require("@/components/rail-footer");
const select_1 = require("@higgsfield/quanta/select");
const setting_trigger_1 = require("@/components/setting-trigger");
const tabs_1 = require("@higgsfield/quanta/tabs");
const typography_1 = require("@higgsfield/quanta/typography");
const asset_library_1 = require("@/components/asset-library");
const upload_field_1 = require("@/components/upload-field");
const history_grid_1 = require("@/components/history-grid");
const template_modal_1 = require("@/components/template-modal");
/**
 * Preset app screen template (modeled on the Higgsfield SC App Builder /
 * Main, node 2950:66563). A builder shell: the input panel on the left (cover
 * picker, prompt composer, voice / aspect-ratio / duration setting rows,
 * marketing Generate CTA) and the preset gallery on the right (segmented
 * tabs, search, 3-col media grid). Quanta components + tokens only.
 */
const PRESETS = [
    { title: 'How product works', src: '/presets/how-product-works.png' },
    { title: 'Explain', src: '/presets/explain.png' },
    { title: 'History', src: '/presets/hyper-motion.png' },
    ...Array.from({ length: 9 }, () => ({ title: 'Hyper motion', src: '/presets/hyper-motion.png' })),
];
/** The same presets, shaped for the `TemplateModal` cover picker. */
const PRESET_OPTIONS = PRESETS.map((preset, index) => ({
    id: `${preset.title}-${index}`,
    label: preset.title,
    image: preset.src,
}));
/** Default cover shown before a preset is picked. */
const DEFAULT_COVER = { src: '/presets/cover.png', title: 'How product works' };
/** "How it works in 3 steps" content — the explainer behind the third tab. */
const STEPS = [
    {
        title: 'Pick a preset',
        description: 'Browse the gallery and choose a preset that matches the video you want to make.',
        preview: (<div className="flex h-full flex-col items-center justify-center gap-3 rounded-q-300 border border-dashed border-q-border-subtle px-8">
        <icon_1.Icon as={auto_stories_svg_react_1.default} size="md" color="secondary"/>
        <div className="flex flex-col items-center gap-1 text-center">
          <typography_1.Typography as="span" variant="body-sm-semi-bold" color="primary" className="uppercase">
            Browse presets
          </typography_1.Typography>
          <typography_1.Typography as="span" variant="caption-xs-regular" color="secondary">
            Explain, Hyper motion, and more
          </typography_1.Typography>
        </div>
      </div>),
    },
    {
        title: 'Add your topic & generate',
        description: 'Type what the video should explain, set voice and duration, then press Generate.',
        preview: (<div className="flex h-full items-center justify-center">
        <button_1.Button variant="marketingPrimary" size="lg" start={<icon_sparkles_soft_svg_react_1.default width={18} height={18}/>}>
          Generate
        </button_1.Button>
      </div>),
    },
    {
        title: 'Get your result',
        description: 'Your video is ready! Preview it, then download and share the final result.',
        preview: (<div className="flex h-full items-center justify-center p-6">
        <media_1.Media ratio={16 / 9} rounded="md" className="h-full w-auto max-w-full">
          <media_1.Media.Image src="/presets/explain.png" alt="Generated result preview"/>
        </media_1.Media>
      </div>),
    },
];
const VOICES = ['Cillian', 'Nova', 'Atlas', 'Vera'];
const DURATIONS = [
    { value: '20s', title: '20 seconds' },
    { value: '30s', title: '30 seconds' },
    { value: '1m', title: '1 minute' },
    { value: '3m', title: '3 minutes' },
    { value: '5m', title: '5 minutes' },
    { value: '10m', title: '10 minutes' },
    { value: 'manual', title: 'Manual', subtitle: 'Choose duration manually' },
];
const RATIOS = [
    { value: '16:9', title: '16:9', subtitle: 'Horizontal' },
    { value: '9:16', title: '9:16', subtitle: 'Vertical' },
];
/** Shared popup placement for the rail pickers — opens into the canvas. */
const PICKER_POPUP = {
    size: 'picker',
    surface: 'solid',
    side: 'right',
    align: 'start',
    sideOffset: 8,
    collisionPadding: 16,
};
/** Voice picker — single-line options behind the Voice setting row. */
function VoiceSelect() {
    return (<select_1.Select.Root>
      <select_1.Select.Trigger bare render={<setting_trigger_1.SettingTrigger label="Voice"/>}>
        <select_1.Select.Value placeholder="Select voice"/>
      </select_1.Select.Trigger>
      <select_1.Select.Content {...PICKER_POPUP}>
        {VOICES.map(voice => (<select_1.Select.Item key={voice} value={voice}>
            <select_1.Select.ItemText>{voice}</select_1.Select.ItemText>
            <select_1.Select.ItemIndicator />
          </select_1.Select.Item>))}
      </select_1.Select.Content>
    </select_1.Select.Root>);
}
/** Aspect-ratio picker — two-line options (16:9 Horizontal / 9:16 Vertical). */
function AspectRatioSelect() {
    return (<select_1.Select.Root defaultValue="16:9">
      <select_1.Select.Trigger bare render={<setting_trigger_1.SettingTrigger label="Aspect Ratio"/>}>
        <select_1.Select.Value placeholder="Select ratio"/>
      </select_1.Select.Trigger>
      <select_1.Select.Content {...PICKER_POPUP}>
        {RATIOS.map(ratio => (<select_1.Select.Item key={ratio.value} value={ratio.value}>
            <select_1.Select.ItemContent>
              <select_1.Select.ItemText>{ratio.title}</select_1.Select.ItemText>
              <select_1.Select.ItemDescription>{ratio.subtitle}</select_1.Select.ItemDescription>
            </select_1.Select.ItemContent>
            <select_1.Select.ItemIndicator />
          </select_1.Select.Item>))}
      </select_1.Select.Content>
    </select_1.Select.Root>);
}
/** Duration picker — the trigger echoes the short value ("1m"), rows the full title. */
function DurationSelect() {
    return (<select_1.Select.Root defaultValue="1m">
      <select_1.Select.Trigger bare render={<setting_trigger_1.SettingTrigger label="Duration"/>}>
        <select_1.Select.Value placeholder="Select duration">
          {(value) => (value === 'manual' ? 'Manual' : value)}
        </select_1.Select.Value>
      </select_1.Select.Trigger>
      <select_1.Select.Content {...PICKER_POPUP}>
        {DURATIONS.map(duration => (<select_1.Select.Item key={duration.value} value={duration.value}>
            {duration.subtitle != null
                ? (<select_1.Select.ItemContent>
                    <select_1.Select.ItemText>{duration.title}</select_1.Select.ItemText>
                    <select_1.Select.ItemDescription>{duration.subtitle}</select_1.Select.ItemDescription>
                  </select_1.Select.ItemContent>)
                : <select_1.Select.ItemText>{duration.title}</select_1.Select.ItemText>}
            <select_1.Select.ItemIndicator />
          </select_1.Select.Item>))}
      </select_1.Select.Content>
    </select_1.Select.Root>);
}
/** Left rail — cover picker, prompt composer, setting rows, Generate CTA. */
function InputPanel() {
    // The cover reflects the preset chosen in the TemplateModal picker.
    const [preset, setPreset] = (0, react_1.useState)(null);
    const coverSrc = preset?.image ?? DEFAULT_COVER.src;
    const coverTitle = preset?.label ?? DEFAULT_COVER.title;
    // The optional reference image, picked from the shared AssetLibraryModal.
    const [reference, setReference] = (0, react_1.useState)(null);
    return (<aside className={(0, card_1.card)({ surface: 'solid', elevation: 'raised' }, 
        // Figma input rail: 342px = spacing scale × 85.5. Stretch to the viewport
        // height and scroll internally so the sticky RailFooter can pin the
        // Generate CTA when the chosen fields overflow.
        'w-85.5 shrink-0 gap-3 overflow-y-auto border-q-thin border-q-border-subtle p-3')}>
      <div className="flex items-center px-2 py-0.5">
        <typography_1.Typography as="h1" variant="accent-sm-bold" color="brand" className="uppercase">
          Preset Studio
        </typography_1.Typography>
      </div>

      <template_modal_1.TemplateModal title="Choose a preset" options={PRESET_OPTIONS} value={preset?.id} onSelect={setPreset} trigger={(<media_card_1.MediaCard render={<button type="button"/>} ratio="auto" frame="thin" scrim={false} titleVariant="accent" className="h-40 shrink-0" src={coverSrc} alt="Selected preset cover" title={coverTitle} action={(
            // Passive chip (not a button) — the whole cover is the modal trigger.
            <span className="q-media-card-action">
                Change
                <icon_1.Icon size="sm" as={edit_svg_react_1.default}/>
              </span>)}/>)}/>

      <composer_1.Composer label="What should the video explain?" placeholder="Type a topic, or attach files below" actions={<>
            <asset_library_1.AssetLibraryModal trigger={<composer_1.Composer.Action start={<icon_1.Icon size="sm" as={add_svg_react_1.default}/>}>
                  Attach files
                </composer_1.Composer.Action>}/>
            <composer_1.Composer.Action start={<icon_1.Icon size="sm" as={link_svg_react_1.default}/>}>
              Link
            </composer_1.Composer.Action>
          </>}/>

      {/* Reference-image upload — an UploadField that opens the shared
            AssetLibraryModal; picking an asset switches it to the filled state. */}
      {reference == null
            ? (<asset_library_1.AssetLibraryModal onSelect={setReference} trigger={(<upload_field_1.UploadField render={<button type="button"/>} icon={image_svg_react_1.default} title="Add a reference image" subtitle="PNG or JPG, up to 20MB"/>)}/>)
            : (<upload_field_1.UploadField preview={reference.src} previewAlt={reference.name} onRemove={() => setReference(null)}/>)}

      <VoiceSelect />
      <div className="flex w-full gap-2">
        <AspectRatioSelect />
        <DurationSelect />
      </div>

      <rail_footer_1.RailFooter>
        <button_1.Button variant="marketingPrimary" size="lg" className="w-full" end={<span className="flex items-center gap-2">
              <icon_sparkles_soft_svg_react_1.default width={18} height={18}/>
              <span className="text-q-body-md-semi-bold">22</span>
            </span>}>
          Generate
        </button_1.Button>
      </rail_footer_1.RailFooter>
    </aside>);
}
/** Per-orientation grid knobs: column count + the `MediaCard` media ratio. */
const PRESET_GRID_LAYOUT = {
    horizontal: { cols: 3, ratio: 'video' },
    vertical: { cols: 4, ratio: 9 / 16 },
};
/** The preset media grid — shared by the Presets and How-it-works tabs. */
function PresetGrid({ orientation = 'horizontal' }) {
    // Default to the first preset for a nicer initial state; clicking selects.
    const [selected, setSelected] = (0, react_1.useState)(0);
    const layout = PRESET_GRID_LAYOUT[orientation];
    return (<card_1.Card surface="solid" className="min-h-0 flex-1 overflow-y-auto p-4">
      <grid_1.Grid cols={layout.cols} gap={4}>
        {PRESETS.map((preset, index) => (<media_card_1.MediaCard key={`${preset.title}-${index}`} render={<button type="button"/>} frame="none" ratio={layout.ratio} selected={index === selected} aria-pressed={index === selected} onClick={() => setSelected(index)} src={preset.src} alt={preset.title} title={preset.title} className="transition-transform duration-200 ease-out hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"/>))}
      </grid_1.Grid>
    </card_1.Card>);
}
/** "How it works in 3 steps" explainer — the third tab's panel content. */
function HowItWorks() {
    return (<card_1.Card surface="solid" className="min-h-0 flex-1 overflow-y-auto p-6">
      <section className="flex flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <typography_1.Typography as="h2" variant="accent-lg-bold" color="primary" className="uppercase">
            How it works
            {' '}
            <span className="text-q-text-brand">in 3 steps</span>
          </typography_1.Typography>
        </header>

        <div className="grid gap-10 md:grid-cols-3">
          {STEPS.map((step, index) => (<div key={step.title} className="flex flex-col gap-4">
              <div className="h-60 overflow-hidden rounded-q-400 bg-q-transparent-light-05">
                {step.preview}
              </div>
              <div className="flex flex-col gap-2">
                <typography_1.Typography as="h3" variant="accent-xs-bold" color="primary" className="uppercase">
                  {`${index + 1}. ${step.title}`}
                </typography_1.Typography>
                <typography_1.Typography as="p" variant="body-sm-regular" color="secondary">
                  {step.description}
                </typography_1.Typography>
              </div>
            </div>))}
        </div>
      </section>
    </card_1.Card>);
}
/** Right column — segmented tabs + search over the preset gallery. */
function PresetGallery({ orientation = 'horizontal' }) {
    return (<section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* `flex!` — the q-tabs utility hard-sets `display: block`, which would
            otherwise beat this class and kill both the gap and the height chain. */}
      <tabs_1.Tabs.Root variant="segmented" defaultValue="presets" className="flex! min-h-0 flex-1 flex-col gap-3">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <tabs_1.Tabs.List items={[
            { value: 'presets', label: 'Presets', start: <icon_1.Icon size="sm" as={auto_stories_svg_react_1.default}/> },
            { value: 'history', label: 'History', start: <icon_1.Icon size="sm" as={folder_svg_react_1.default}/> },
            { value: 'how-it-works', label: 'How it works', start: <icon_1.Icon size="sm" as={newspaper_svg_react_1.default}/> },
        ]}/>
          <input_1.Input placeholder="Search" aria-label="Search presets" className="w-50" start={<icon_1.Icon size="sm" as={search_svg_react_1.default}/>}/>
        </header>

        <tabs_1.Tabs.Panel value="presets" className="flex min-h-0 flex-1 flex-col pt-0">
          <PresetGrid orientation={orientation}/>
        </tabs_1.Tabs.Panel>
        <tabs_1.Tabs.Panel value="history" className="flex min-h-0 flex-1 flex-col pt-0">
          <card_1.Card surface="solid" className="min-h-0 flex-1 overflow-y-auto p-4">
            <history_grid_1.HistoryGrid />
          </card_1.Card>
        </tabs_1.Tabs.Panel>
        <tabs_1.Tabs.Panel value="how-it-works" className="flex min-h-0 flex-1 flex-col pt-0">
          <HowItWorks />
        </tabs_1.Tabs.Panel>
      </tabs_1.Tabs.Root>
    </section>);
}
function PresetTemplate({ presetOrientation = 'horizontal' } = {}) {
    return (<div className="flex h-dvh gap-5 overflow-hidden bg-q-background-primary px-4 py-3">
      <InputPanel />
      <PresetGallery orientation={presetOrientation}/>
    </div>);
}
//# sourceMappingURL=preset.js.map