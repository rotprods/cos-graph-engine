"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiStylistTemplate = AiStylistTemplate;
const react_1 = require("react");
const accessibility_new_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/accessibility_new.svg?react"));
const apparel_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/apparel.svg?react"));
const aspect_ratio_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/aspect_ratio.svg?react"));
const checkroom_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/checkroom.svg?react"));
const folder_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/folder.svg?react"));
const newspaper_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/newspaper.svg?react"));
const edit_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/edit.svg?react"));
const person_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/person.svg?react"));
const search_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/search.svg?react"));
const styler_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/styler.svg?react"));
const wallpaper_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/wallpaper.svg?react"));
const icon_sparkles_soft_svg_react_1 = __importDefault(require("@/assets/icon-sparkles-soft.svg?react"));
const accordion_1 = require("@higgsfield/quanta/accordion");
const button_1 = require("@higgsfield/quanta/button");
const card_1 = require("@higgsfield/quanta/card");
const grid_1 = require("@higgsfield/quanta/grid");
const icon_1 = require("@higgsfield/quanta/icon");
const input_1 = require("@higgsfield/quanta/input");
const loader_1 = require("@higgsfield/quanta/loader");
const select_1 = require("@higgsfield/quanta/select");
const tabs_1 = require("@higgsfield/quanta/tabs");
const typography_1 = require("@higgsfield/quanta/typography");
const asset_library_1 = require("@/components/asset-library");
const generation_card_1 = require("@/components/generation-card");
const generation_detail_1 = require("@/components/generation-detail");
const history_grid_1 = require("@/components/history-grid");
const media_card_1 = require("@/components/media-card");
const rail_footer_1 = require("@/components/rail-footer");
const setting_trigger_1 = require("@/components/setting-trigger");
const template_modal_1 = require("@/components/template-modal");
const upload_field_1 = require("@/components/upload-field");
/**
 * AI Stylist app screen template — a rebuild of the live Higgsfield "AI Stylist"
 * app (https://higgsfield.ai/apps/ai-stylist) in our design system. The real
 * page's promise: "Upload your own clothes or mix and match from presets. Change
 * poses, backgrounds, and try on complete outfits instantly."
 *
 * Structure & flow mapped onto our components (Quanta + `@/components/*`, dark,
 * no host chrome):
 *   • Left settings rail (`StylistRail`) — compact & focused: the PRIMARY input
 *     (upload your photo, `UploadField` → `AssetLibraryModal`) and the PRIMARY
 *     action (costed marketing Generate CTA) stay visible, while every secondary
 *     choice — the outfit (`MediaCard` cover → `TemplateModal` + own-clothes
 *     `UploadField`), pose / background / aspect-ratio (`SettingTrigger` +
 *     `Select`) — is COLLAPSED under a titled `Accordion` section and expands on
 *     demand (progressive disclosure, mirroring the ref's grouped option lists).
 *   • Right workspace (`StylistGallery`) — segmented `Tabs` + search over four
 *     panels: an outfit-preset gallery (`MediaCard` grid, mix-and-match), the
 *     live generation Results canvas (`GenerationCard` generating → result grid
 *     opening `GenerationDetailModal`), personal History (`HistoryGrid`), and a
 *     "how it works in 3 steps" explainer.
 *
 * This is a full workspace shell (rail + gallery), so it fills the viewport
 * rather than the centered `max-w-7xl` page.
 */
/** Preview covers reused across the outfit gallery, presets picker and results. */
const COVERS = [
    '/presets/cover.png',
    '/presets/explain.png',
    '/presets/hyper-motion.png',
    '/presets/how-product-works.png',
];
/** Outfit presets — the "mix and match from presets" gallery + cover picker. */
const OUTFITS = [
    { id: 'old-money', label: 'Old Money', image: COVERS[0] },
    { id: 'streetwear', label: 'Streetwear', image: COVERS[1] },
    { id: 'evening-gown', label: 'Evening Gown', image: COVERS[2] },
    { id: 'business', label: 'Business Casual', image: COVERS[3] },
    { id: 'summer-linen', label: 'Summer Linen', image: COVERS[1] },
    { id: 'denim', label: 'Denim on Denim', image: COVERS[0] },
    { id: 'athleisure', label: 'Athleisure', image: COVERS[2] },
    { id: 'boho', label: 'Boho Chic', image: COVERS[3] },
    { id: 'leather', label: 'Leather Jacket', image: COVERS[1] },
    { id: 'trench', label: 'Trench Coat', image: COVERS[0] },
    { id: 'cocktail', label: 'Cocktail Dress', image: COVERS[2] },
    { id: 'techwear', label: 'Techwear', image: COVERS[3] },
];
/** The default cover shown before an outfit is picked. */
const DEFAULT_OUTFIT = { id: 'old-money', label: 'Old Money', image: COVERS[0] };
const POSES = ['Natural', 'Full body', 'Walking', 'Seated', 'Three-quarter', 'Profile'];
const BACKGROUNDS = [
    { value: 'studio', title: 'Studio', subtitle: 'Clean seamless backdrop' },
    { value: 'street', title: 'City street', subtitle: 'Editorial street style' },
    { value: 'runway', title: 'Runway', subtitle: 'Catwalk lighting' },
    { value: 'beach', title: 'Beach', subtitle: 'Golden-hour coastline' },
    { value: 'cafe', title: 'Café', subtitle: 'Warm interior' },
    { value: 'keep', title: 'Keep original', subtitle: 'Use your photo\u2019s background' },
];
const RATIOS = [
    { value: '3:4', title: '3:4', subtitle: 'Portrait' },
    { value: '1:1', title: '1:1', subtitle: 'Square' },
    { value: '9:16', title: '9:16', subtitle: 'Story' },
];
/** The styled looks revealed once a (simulated) generation finishes. */
const RESULT_LOOKS = [
    {
        src: COVERS[0],
        prompt: 'Full-body editorial portrait of the subject in a tailored old-money ensemble, soft studio light, 3:4 fashion photography.',
    },
    {
        src: COVERS[2],
        prompt: 'The same subject styled in a flowing evening gown, three-quarter pose against a runway backdrop, dramatic rim light.',
    },
    {
        src: COVERS[1],
        prompt: 'Street-style look with layered outerwear, natural walking pose on a city street, overcast daylight.',
    },
    {
        src: COVERS[3],
        prompt: 'Business-casual outfit, seated pose in a warm café interior, shallow depth of field.',
    },
];
/** Shared popup placement for the rail pickers — opens into the workspace. */
const PICKER_POPUP = {
    size: 'picker',
    surface: 'solid',
    side: 'right',
    align: 'start',
    sideOffset: 8,
    collisionPadding: 16,
};
/** Pose picker — single-line options behind the Pose setting row. */
function PoseSelect() {
    return (<select_1.Select.Root defaultValue="Natural">
      <select_1.Select.Trigger bare render={<setting_trigger_1.SettingTrigger label="Pose" start={<icon_1.Icon size="sm" as={accessibility_new_svg_react_1.default}/>}/>}>
        <select_1.Select.Value placeholder="Select pose"/>
      </select_1.Select.Trigger>
      <select_1.Select.Content {...PICKER_POPUP}>
        {POSES.map(pose => (<select_1.Select.Item key={pose} value={pose}>
            <select_1.Select.ItemText>{pose}</select_1.Select.ItemText>
            <select_1.Select.ItemIndicator />
          </select_1.Select.Item>))}
      </select_1.Select.Content>
    </select_1.Select.Root>);
}
/** Background picker — two-line options (title + description). */
function BackgroundSelect() {
    return (<select_1.Select.Root defaultValue="studio">
      <select_1.Select.Trigger bare render={<setting_trigger_1.SettingTrigger label="Background" start={<icon_1.Icon size="sm" as={wallpaper_svg_react_1.default}/>}/>}>
        <select_1.Select.Value placeholder="Select background">
          {(value) => BACKGROUNDS.find(b => b.value === value)?.title ?? value}
        </select_1.Select.Value>
      </select_1.Select.Trigger>
      <select_1.Select.Content {...PICKER_POPUP}>
        {BACKGROUNDS.map(background => (<select_1.Select.Item key={background.value} value={background.value}>
            <select_1.Select.ItemContent>
              <select_1.Select.ItemText>{background.title}</select_1.Select.ItemText>
              <select_1.Select.ItemDescription>{background.subtitle}</select_1.Select.ItemDescription>
            </select_1.Select.ItemContent>
            <select_1.Select.ItemIndicator />
          </select_1.Select.Item>))}
      </select_1.Select.Content>
    </select_1.Select.Root>);
}
/** Aspect-ratio picker — two-line options (3:4 Portrait / 1:1 Square / 9:16 Story). */
function AspectRatioSelect() {
    return (<select_1.Select.Root defaultValue="3:4">
      <select_1.Select.Trigger bare render={<setting_trigger_1.SettingTrigger label="Aspect Ratio" start={<icon_1.Icon size="sm" as={aspect_ratio_svg_react_1.default}/>}/>}>
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
/**
 * Left settings rail — compact & focused (see `../layouts/AGENTS.md`): the
 * PRIMARY input (your photo) and the PRIMARY action (Generate) stay visible;
 * every secondary/optional choice (outfit, pose, background, aspect ratio) is
 * COLLAPSED under a titled `Accordion` section and expands on demand, mirroring
 * the live AI Stylist's grouped option lists. All sections start collapsed and
 * `multiple={false}` keeps at most one open at a time.
 */
function StylistRail({ outfit, onOutfitChange, busy, onGenerate }) {
    // Your photo — the subject to restyle (picked from the shared AssetLibraryModal).
    const [photo, setPhoto] = (0, react_1.useState)(null);
    // Your own clothes — the optional "upload your own garment" input.
    const [garment, setGarment] = (0, react_1.useState)(null);
    return (<aside className={(0, card_1.card)({ surface: 'solid', elevation: 'raised' }, 
        // Figma input rail width: 342px = spacing scale × 85.5. Stretch to the
        // viewport height and scroll internally so the sticky RailFooter can pin
        // the Generate CTA when the chosen fields overflow.
        'w-85.5 shrink-0 gap-3 overflow-y-auto border-q-thin border-q-border-subtle p-3')}>
      <div className="flex flex-col gap-1 px-2 py-0.5">
        <typography_1.Typography as="h1" variant="accent-sm-bold" color="brand" className="uppercase">
          AI Stylist
        </typography_1.Typography>
        <typography_1.Typography as="p" variant="caption-xs-regular" color="secondary">
          Restyle your photo into any outfit, pose and background.
        </typography_1.Typography>
      </div>

      {/* PRIMARY input — your photo, always visible (the subject to restyle). */}
      {photo == null
            ? (<asset_library_1.AssetLibraryModal onSelect={setPhoto} trigger={(<upload_field_1.UploadField render={<button type="button"/>} icon={person_svg_react_1.default} title="Upload your photo" subtitle="A clear portrait or full-body shot"/>)}/>)
            : (<upload_field_1.UploadField preview={photo.src} previewAlt={photo.name} onRemove={() => setPhoto(null)}/>)}

      {/* Secondary choices — collapsed by default, one open at a time. */}
      <accordion_1.Accordion.Root variant="separated" size="sm">
        {/* The outfit: mix and match from presets… or upload your own clothes. */}
        <accordion_1.Accordion.Item value="outfit">
          <accordion_1.Accordion.Trigger start={<icon_1.Icon size="sm" as={checkroom_svg_react_1.default}/>}>
            Outfit
          </accordion_1.Accordion.Trigger>
          <accordion_1.Accordion.Panel contentClassName="flex flex-col gap-3">
            <template_modal_1.TemplateModal title="Choose an outfit" options={OUTFITS} value={outfit.id} onSelect={onOutfitChange} trigger={(<media_card_1.MediaCard render={<button type="button"/>} ratio="auto" frame="thin" scrim={false} titleVariant="accent" className="h-40 shrink-0" src={outfit.image} alt={`${outfit.label} outfit`} title={outfit.label} action={(<span className="q-media-card-action">
                      Change
                      <icon_1.Icon size="sm" as={edit_svg_react_1.default}/>
                    </span>)}/>)}/>
            {garment == null
            ? (<asset_library_1.AssetLibraryModal onSelect={setGarment} trigger={(<upload_field_1.UploadField render={<button type="button"/>} border="solid" icon={apparel_svg_react_1.default} title="Or upload your own clothes" subtitle="PNG or JPG of a garment, up to 20MB"/>)}/>)
            : (<upload_field_1.UploadField preview={garment.src} previewAlt={garment.name} onRemove={() => setGarment(null)}/>)}
          </accordion_1.Accordion.Panel>
        </accordion_1.Accordion.Item>

        <accordion_1.Accordion.Item value="pose">
          <accordion_1.Accordion.Trigger start={<icon_1.Icon size="sm" as={accessibility_new_svg_react_1.default}/>}>
            Pose
          </accordion_1.Accordion.Trigger>
          <accordion_1.Accordion.Panel contentClassName="flex flex-col gap-3">
            <PoseSelect />
          </accordion_1.Accordion.Panel>
        </accordion_1.Accordion.Item>

        <accordion_1.Accordion.Item value="background">
          <accordion_1.Accordion.Trigger start={<icon_1.Icon size="sm" as={wallpaper_svg_react_1.default}/>}>
            Background
          </accordion_1.Accordion.Trigger>
          <accordion_1.Accordion.Panel contentClassName="flex flex-col gap-3">
            <BackgroundSelect />
          </accordion_1.Accordion.Panel>
        </accordion_1.Accordion.Item>

        <accordion_1.Accordion.Item value="ratio">
          <accordion_1.Accordion.Trigger start={<icon_1.Icon size="sm" as={aspect_ratio_svg_react_1.default}/>}>
            Aspect ratio
          </accordion_1.Accordion.Trigger>
          <accordion_1.Accordion.Panel contentClassName="flex flex-col gap-3">
            <AspectRatioSelect />
          </accordion_1.Accordion.Panel>
        </accordion_1.Accordion.Item>
      </accordion_1.Accordion.Root>

      <rail_footer_1.RailFooter>
        <button_1.Button variant="marketingPrimary" size="lg" className="w-full" disabled={busy} onClick={onGenerate} start={busy ? <loader_1.Loader size="xs" color="neutral"/> : undefined} end={busy
            ? undefined
            : (<span className="flex items-center gap-2">
                    <icon_sparkles_soft_svg_react_1.default width={14} height={14}/>
                    <span className="text-q-body-md-semi-bold">8</span>
                  </span>)}>
          {busy ? 'Styling\u2026' : 'Generate'}
        </button_1.Button>
      </rail_footer_1.RailFooter>
    </aside>);
}
/** The outfit-preset gallery — portrait tiles, click to select (mix and match). */
function OutfitGallery({ selectedId, onSelect }) {
    return (<card_1.Card surface="solid" className="min-h-0 flex-1 overflow-y-auto p-4">
      <grid_1.Grid cols={4} gap={4}>
        {OUTFITS.map(outfit => (<media_card_1.MediaCard key={outfit.id} render={<button type="button"/>} frame="none" ratio={3 / 4} selected={outfit.id === selectedId} aria-pressed={outfit.id === selectedId} onClick={() => onSelect(outfit)} src={outfit.image} alt={`${outfit.label} outfit`} title={outfit.label} className="transition-transform duration-200 ease-out hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"/>))}
      </grid_1.Grid>
    </card_1.Card>);
}
/** The Results canvas — idle empty state → generating → styled result grid. */
function ResultsPanel({ stage, outfit }) {
    if (stage === 'idle') {
        return (<card_1.Card surface="solid" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex items-center justify-center rounded-q-full bg-q-transparent-light-05 p-4">
          <icon_1.Icon as={styler_svg_react_1.default} size="lg" color="secondary"/>
        </span>
        <div className="flex max-w-sm flex-col gap-1">
          <typography_1.Typography as="h2" variant="body-md-semi-bold" color="primary">
            Your styled looks will appear here
          </typography_1.Typography>
          <typography_1.Typography as="p" variant="body-sm-regular" color="secondary">
            Upload your photo, pick an outfit, then press Generate to try on a
            complete look instantly.
          </typography_1.Typography>
        </div>
      </card_1.Card>);
    }
    return (<card_1.Card surface="solid" className="min-h-0 flex-1 overflow-y-auto p-4">
      <grid_1.Grid cols="auto-fit" minColWidth="14rem" gap={4}>
        {stage === 'generating'
            ? RESULT_LOOKS.map((_, index) => (<generation_card_1.GenerationCard key={index} state="generating" ratio={3 / 4}/>))
            : RESULT_LOOKS.map((look, index) => (<generation_detail_1.GenerationDetailModal key={index} generation={{
                    src: look.src,
                    mediaType: 'image',
                    aspectRatio: 3 / 4,
                    prompt: look.prompt,
                    fileType: 'JPG',
                    author: { name: 'AI Stylist', role: 'Generated look' },
                }} trigger={(<generation_card_1.GenerationCard render={<button type="button"/>} ratio={3 / 4} src={look.src} alt={`${outfit.label} styled look ${index + 1}`} className="group cursor-pointer"/>)}/>))}
      </grid_1.Grid>
    </card_1.Card>);
}
/** "How it works in 3 steps" explainer — the fourth tab's panel content. */
const STEPS = [
    {
        title: 'Upload your photo',
        description: 'Add a clear portrait or full-body shot — this is the person we\u2019ll restyle.',
        preview: (<div className="flex h-full flex-col items-center justify-center gap-3 rounded-q-300 border border-dashed border-q-border-subtle px-8">
        <icon_1.Icon as={person_svg_react_1.default} size="md" color="secondary"/>
        <div className="flex flex-col items-center gap-1 text-center">
          <typography_1.Typography as="span" variant="body-sm-semi-bold" color="primary" className="uppercase">
            Upload your photo
          </typography_1.Typography>
          <typography_1.Typography as="span" variant="caption-xs-regular" color="secondary">
            Portrait, selfie or full-body shot
          </typography_1.Typography>
        </div>
      </div>),
    },
    {
        title: 'Pick or upload an outfit',
        description: 'Mix and match from the outfit presets, or upload your own clothes to try on.',
        preview: (<div className="flex h-full items-center justify-center gap-3 p-6">
        <icon_1.Icon as={checkroom_svg_react_1.default} size="md" color="secondary"/>
        <icon_1.Icon as={apparel_svg_react_1.default} size="md" color="secondary"/>
      </div>),
    },
    {
        title: 'Generate your look',
        description: 'Set the pose and background, then press Generate to try on the complete outfit.',
        preview: (<div className="flex h-full items-center justify-center">
        <button_1.Button variant="marketingPrimary" size="lg" end={<icon_sparkles_soft_svg_react_1.default width={14} height={14}/>}>
          Generate
        </button_1.Button>
      </div>),
    },
];
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
/** Right column — segmented tabs + search over the workspace panels. */
function StylistGallery({ tab, onTabChange, stage, outfit, onOutfitSelect }) {
    return (<section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* `flex!` — the q-tabs utility hard-sets `display: block`, which would
            otherwise beat this class and kill both the gap and the height chain. */}
      <tabs_1.Tabs.Root variant="segmented" value={tab} onValueChange={value => onTabChange(value)} className="flex! min-h-0 flex-1 flex-col gap-3">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <tabs_1.Tabs.List items={[
            { value: 'outfits', label: 'Outfits', start: <icon_1.Icon size="sm" as={checkroom_svg_react_1.default}/> },
            { value: 'results', label: 'Results', start: <icon_1.Icon size="sm" as={styler_svg_react_1.default}/> },
            { value: 'history', label: 'History', start: <icon_1.Icon size="sm" as={folder_svg_react_1.default}/> },
            { value: 'how-it-works', label: 'How it works', start: <icon_1.Icon size="sm" as={newspaper_svg_react_1.default}/> },
        ]}/>
          <input_1.Input placeholder="Search outfits" aria-label="Search outfits" className="w-50" start={<icon_1.Icon size="sm" as={search_svg_react_1.default}/>}/>
        </header>

        <tabs_1.Tabs.Panel value="outfits" className="flex min-h-0 flex-1 flex-col pt-0">
          <OutfitGallery selectedId={outfit.id} onSelect={onOutfitSelect}/>
        </tabs_1.Tabs.Panel>
        <tabs_1.Tabs.Panel value="results" className="flex min-h-0 flex-1 flex-col pt-0">
          <ResultsPanel stage={stage} outfit={outfit}/>
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
function AiStylistTemplate() {
    const [outfit, setOutfit] = (0, react_1.useState)(DEFAULT_OUTFIT);
    const [tab, setTab] = (0, react_1.useState)('outfits');
    const [stage, setStage] = (0, react_1.useState)('idle');
    const timerRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => () => {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
    }, []);
    const handleGenerate = () => {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
        setStage('generating');
        setTab('results');
        timerRef.current = setTimeout(() => setStage('result'), 2200);
    };
    return (<div className="flex h-dvh gap-5 overflow-hidden bg-q-background-primary px-4 py-3">
      <StylistRail outfit={outfit} onOutfitChange={setOutfit} busy={stage === 'generating'} onGenerate={handleGenerate}/>
      <StylistGallery tab={tab} onTabChange={setTab} stage={stage} outfit={outfit} onOutfitSelect={setOutfit}/>
    </div>);
}
//# sourceMappingURL=ai-stylist.js.map