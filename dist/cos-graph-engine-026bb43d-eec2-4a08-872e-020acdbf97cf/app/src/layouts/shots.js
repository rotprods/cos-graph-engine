"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotsTemplate = ShotsTemplate;
const react_1 = require("react");
const add_photo_alternate_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/add_photo_alternate.svg?react"));
const autorenew_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/autorenew.svg?react"));
const download_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/download.svg?react"));
const high_quality_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/high_quality.svg?react"));
const upload_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/upload.svg?react"));
const icon_sparkles_soft_svg_react_1 = __importDefault(require("@/assets/icon-sparkles-soft.svg?react"));
const button_1 = require("@higgsfield/quanta/button");
const card_1 = require("@higgsfield/quanta/card");
const checkbox_1 = require("@higgsfield/quanta/checkbox");
const grid_1 = require("@higgsfield/quanta/grid");
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
const asset_library_1 = require("@/components/asset-library");
const before_after_compare_1 = require("@/components/before-after-compare");
const generation_card_1 = require("@/components/generation-card");
const generation_detail_1 = require("@/components/generation-detail");
const step_rail_1 = require("@/components/step-rail");
const STEPS = [
    { id: 'upload', label: 'Upload' },
    { id: 'grid', label: 'Grid' },
    { id: 'upscale', label: 'Upscale' },
];
/** The example source shown before the user uploads their own image. */
const HERO_EXAMPLE = '/presets/cover.png';
const PREVIEWS = [
    '/presets/cover.png',
    '/presets/how-product-works.png',
    '/presets/explain.png',
    '/presets/hyper-motion.png',
];
/**
 * The 9 cinematic camera angles Shots derives from one image. Each cycles a
 * local preview asset — the shape (title + prompt) is what matters for the flow.
 */
const ANGLES = [
    { label: 'Wide shot', prompt: 'Full-body wide establishing shot, subject centered, cinematic depth.' },
    { label: 'Medium shot', prompt: 'Waist-up medium shot, shallow depth of field, editorial lighting.' },
    { label: 'Close-up', prompt: 'Tight close-up on the face, soft key light, filmic contrast.' },
    { label: 'Extreme close-up', prompt: 'Extreme close-up on the eyes, macro detail, dramatic mood.' },
    { label: 'Over-the-shoulder', prompt: 'Over-the-shoulder framing, foreground bokeh, narrative depth.' },
    { label: 'Low angle', prompt: 'Low-angle hero shot looking up, powerful and imposing.' },
    { label: 'High angle', prompt: 'High-angle shot looking down, vulnerable, wide context.' },
    { label: 'Dutch angle', prompt: 'Tilted Dutch angle, tension and unease, dynamic composition.' },
    { label: "Bird's-eye", prompt: "Top-down bird's-eye view, graphic and geometric staging." },
];
const ANGLE_TILES = ANGLES.map((angle, index) => ({
    ...angle,
    id: `${angle.label}-${index}`,
    src: PREVIEWS[index % PREVIEWS.length],
}));
/** Simulated backend costs, shown inside the marketing CTAs. */
const GRID_COST = 18;
const UPSCALE_COST = 12;
/** ~2s simulated backend delay for the generate / upscale transitions. */
const SIMULATED_DELAY = 2000;
/* ── Shared CTA slot ──────────────────────────────────────────────────────── */
/** The branded `{sparkles} {credits}` cost slot for a marketing Generate CTA. */
function CostSlot({ credits }) {
    return (<span className="flex items-center gap-2">
      <icon_sparkles_soft_svg_react_1.default width={14} height={14}/>
      <span className="text-q-body-md-semi-bold">{credits}</span>
    </span>);
}
function UploadStep({ source, onUpload, onGenerate }) {
    const previewSrc = source ?? HERO_EXAMPLE;
    return (<card_1.Card surface="solid" className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-q-600 border border-q-border-subtle p-6 text-center">
      {/* The hero preview doubles as an upload trigger — clicking it (or the
            button below) opens the shared AssetLibraryModal. */}
      <asset_library_1.AssetLibraryModal onSelect={onUpload} trigger={(<button type="button" className="group relative w-full overflow-hidden rounded-q-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-border-focus">
            <media_1.Media ratio="video" rounded="md" className="w-full">
              <media_1.Media.Image src={previewSrc} alt={source != null ? 'Your source image' : 'Example — two people mid-scene'}/>
              <media_1.Media.Overlay placement="center" className="justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="flex h-9 items-center gap-1.5 rounded-q-full bg-q-transparent-dark-60 px-3 text-q-text-primary backdrop-blur-sm">
                  <typography_1.Typography as="span" variant="caption-xs-medium" color="primary" className="uppercase">
                    {source != null ? 'Change image' : 'Upload image'}
                  </typography_1.Typography>
                  <icon_1.Icon as={add_photo_alternate_svg_react_1.default} size="sm"/>
                </span>
              </media_1.Media.Overlay>
            </media_1.Media>
          </button>)}/>

      <div className="flex flex-col gap-2">
        <typography_1.Typography as="h1" variant="accent-xl-bold" color="primary" className="uppercase">
          Shots
        </typography_1.Typography>
        <typography_1.Typography as="p" variant="body-md-regular" color="secondary">
          Upload one image, get 9 cinematic angles. Select your favorites and upscale to 4K.
        </typography_1.Typography>
      </div>

      {source == null
            ? (<asset_library_1.AssetLibraryModal onSelect={onUpload} trigger={(<button_1.Button variant="secondary" size="lg" className="w-full" start={<icon_1.Icon as={upload_svg_react_1.default} size="sm"/>}>
                  Upload image
                </button_1.Button>)}/>)
            : (<button_1.Button variant="marketingPrimary" size="lg" className="w-full" onClick={onGenerate} end={<CostSlot credits={GRID_COST}/>}>
              Generate 9 angles
            </button_1.Button>)}
    </card_1.Card>);
}
/** A single result tile — a selectable `GenerationCard` that opens the detail modal. */
function AngleTile({ tile, selected, onToggle }) {
    // Download is a template stub — no real asset export is wired here.
    const handleDownload = () => { };
    return (<generation_card_1.GenerationCard ratio="portrait" src={tile.src} alt={tile.label} title={tile.label} className={(0, utils_1.cn)('group', selected && 'ring-2 ring-q-brand-primary')}>
      {/* The tile body opens the shared detail lightbox — a full-bleed trigger
            UNDER the checkbox (they are siblings, never nested, so a click on the
            checkbox toggles selection and never opens the modal). */}
      <generation_detail_1.GenerationDetailModal generation={{ src: tile.src, mediaType: 'image', aspectRatio: 3 / 4, prompt: tile.prompt, fileType: 'PNG' }} trigger={(<button type="button" aria-label={`Preview ${tile.label}`} className="absolute inset-0 z-10 rounded-q-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-border-focus"/>)}/>

      {/* Favorite/selection control — the Quanta Checkbox (brand, md), matching
            the Figma checkbox states (unchecked 1442:137 / checked 1442:125).
            `checked` mirrors the tile's selected state; the subtle drop shadow
            keeps the unchecked box legible over bright media. The arbitrary
            property recolors the checkbox's own UNCHECKED-hover border token to
            full white — the checked (lime fill) state uses a different rule, so
            it is unaffected. */}
      <checkbox_1.Checkbox color="brand" size="md" checked={selected} onCheckedChange={onToggle} aria-label={selected ? `Unselect ${tile.label}` : `Select ${tile.label}`} className="absolute top-2 left-2 z-20 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] [--q-checkbox-hover-border:var(--hf-color-palette-white)]!"/>

      {/* Round glass Download button (top-right, mirrors the checkbox) — a real
            accessible button, sibling of the modal trigger and above it (z-20), so
            clicking it downloads without opening the detail modal. Reveals on
            hover/focus like the other tile hover controls. */}
      <button type="button" aria-label={`Download ${tile.label}`} onClick={handleDownload} className="absolute top-2 right-2 z-20 flex size-8 items-center justify-center rounded-q-full bg-q-transparent-dark-40 text-q-text-primary opacity-0 backdrop-blur-sm transition-opacity hover:bg-q-transparent-dark-60 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-q-border-focus group-hover:opacity-100">
        <icon_1.Icon as={download_svg_react_1.default} size="sm"/>
      </button>
    </generation_card_1.GenerationCard>);
}
function GridStep({ source, stage, selected, onToggle, onRegenerate, onUpscale }) {
    const generating = stage === 'generating';
    const selectedCount = selected.size;
    return (<div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-q-150">
            <media_1.Media ratio="square" rounded="none" className="h-full w-full">
              <media_1.Media.Image src={source ?? HERO_EXAMPLE} alt="Source image"/>
            </media_1.Media>
          </div>
          <div className="flex flex-col">
            <typography_1.Typography as="h2" variant="accent-sm-bold" color="primary" className="uppercase">
              9 cinematic angles
            </typography_1.Typography>
            <typography_1.Typography as="span" variant="body-sm-regular" color="secondary">
              {generating ? 'Rendering your angles…' : 'Select your favorites, then upscale to 4K.'}
            </typography_1.Typography>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button_1.Button variant="tertiary" size="sm" onClick={onRegenerate} disabled={generating} start={<icon_1.Icon as={autorenew_svg_react_1.default} size="sm"/>}>
            Regenerate
          </button_1.Button>
          <button_1.Button variant="marketingPrimary" size="sm" onClick={onUpscale} disabled={generating || selectedCount === 0} end={<CostSlot credits={UPSCALE_COST}/>}>
            {selectedCount > 0 ? `Upscale ${selectedCount} selected` : 'Upscale selected'}
          </button_1.Button>
        </div>
      </header>

      <grid_1.Grid cols={3} gap={4}>
        {generating
            ? ANGLE_TILES.map(tile => (<generation_card_1.GenerationCard key={tile.id} state="generating" ratio="portrait"/>))
            : ANGLE_TILES.map(tile => (<AngleTile key={tile.id} tile={tile} selected={selected.has(tile.id)} onToggle={() => onToggle(tile.id)}/>))}
      </grid_1.Grid>
    </div>);
}
/* ── Step 3 — Upscale ─────────────────────────────────────────────────────── */
/** The finished-tile hover controls — a glass Download button. */
function UpscaleHoverControls() {
    return (<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
      <button_1.Button variant="marketingTertiary" size="md" className="pointer-events-auto" start={<icon_1.Icon as={download_svg_react_1.default} size="sm"/>}>
        Download 4K
      </button_1.Button>
    </div>);
}
function UpscaleStep({ stage, tiles, onUpscale }) {
    const generating = stage === 'generating';
    const ready = stage === 'ready';
    const hero = tiles[0];
    return (<div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <typography_1.Typography as="h2" variant="accent-sm-bold" color="primary" className="uppercase">
            Upscale to 4K
          </typography_1.Typography>
          <typography_1.Typography as="span" variant="body-sm-regular" color="secondary">
            {generating
            ? 'Upscaling your favorites…'
            : ready
                ? 'Your shots are ready in 4K. Download the ones you love.'
                : `${tiles.length} favorite${tiles.length === 1 ? '' : 's'} ready to upscale.`}
          </typography_1.Typography>
        </div>

        {!ready
            ? (<button_1.Button variant="marketingPrimary" size="sm" onClick={onUpscale} disabled={generating} end={<CostSlot credits={UPSCALE_COST}/>}>
                Upscale to 4K
              </button_1.Button>)
            : (<button_1.Button variant="marketingTertiary" size="md" start={<icon_1.Icon as={download_svg_react_1.default} size="sm"/>}>
                Download all
              </button_1.Button>)}
      </header>

      {/* Original ↔ 4K comparison hero for the top favorite. */}
      {hero != null
            ? (<before_after_compare_1.BeforeAfterCompare beforeSrc={hero.src} afterSrc={hero.src} beforeLabel="Original" afterLabel="4K" ratio="wide" className="w-full"/>)
            : null}

      <grid_1.Grid cols={3} gap={4}>
        {tiles.map(tile => (generating
            ? <generation_card_1.GenerationCard key={tile.id} state="generating" ratio="portrait"/>
            : (<generation_card_1.GenerationCard key={tile.id} ratio="portrait" src={tile.src} alt={`${tile.label} — 4K`} title={tile.label} className="group">
                  <span className="pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1 rounded-q-full bg-q-transparent-dark-60 px-2 py-0.5 backdrop-blur-sm">
                    <icon_1.Icon as={high_quality_svg_react_1.default} size="sm" color="primary"/>
                    <typography_1.Typography as="span" variant="caption-xs-medium" color="primary">4K</typography_1.Typography>
                  </span>
                  <UpscaleHoverControls />
                </generation_card_1.GenerationCard>)))}
      </grid_1.Grid>
    </div>);
}
function ShotsTemplate({ preview } = {}) {
    const [step, setStep] = (0, react_1.useState)(preview?.step ?? 'upload');
    const [source, setSource] = (0, react_1.useState)(preview?.source ?? null);
    const [gridStage, setGridStage] = (0, react_1.useState)(preview?.gridStage ?? 'idle');
    const [upscaleStage, setUpscaleStage] = (0, react_1.useState)(preview?.upscaleStage ?? 'idle');
    const [selected, setSelected] = (0, react_1.useState)(() => new Set(ANGLE_TILES.slice(0, preview?.selectedCount ?? 0).map(tile => tile.id)));
    // Simulated-backend timers, created in handlers and cleared on unmount so
    // nothing touches `window` during SSR (same pattern as the app-detail hero).
    const gridTimer = (0, react_1.useRef)(null);
    const upscaleTimer = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => () => {
        if (gridTimer.current != null)
            clearTimeout(gridTimer.current);
        if (upscaleTimer.current != null)
            clearTimeout(upscaleTimer.current);
    }, []);
    const handleUpload = (item) => setSource(item.src);
    const startGrid = () => {
        setStep('grid');
        setGridStage('generating');
        if (gridTimer.current != null)
            clearTimeout(gridTimer.current);
        gridTimer.current = setTimeout(() => setGridStage('ready'), SIMULATED_DELAY);
    };
    const regenerate = () => {
        setSelected(new Set());
        setGridStage('generating');
        if (gridTimer.current != null)
            clearTimeout(gridTimer.current);
        gridTimer.current = setTimeout(() => setGridStage('ready'), SIMULATED_DELAY);
    };
    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const goToUpscale = () => {
        setStep('upscale');
        setUpscaleStage('idle');
    };
    const startUpscale = () => {
        setUpscaleStage('generating');
        if (upscaleTimer.current != null)
            clearTimeout(upscaleTimer.current);
        upscaleTimer.current = setTimeout(() => setUpscaleStage('ready'), SIMULATED_DELAY);
    };
    // Steps the user has unlocked — drives which StepRail markers are clickable.
    const reachable = (0, react_1.useMemo)(() => {
        const ids = ['upload'];
        if (source != null)
            ids.push('grid');
        if (gridStage === 'ready' && selected.size > 0)
            ids.push('upscale');
        return ids;
    }, [source, gridStage, selected]);
    const selectedTiles = (0, react_1.useMemo)(() => ANGLE_TILES.filter(tile => selected.has(tile.id)), [selected]);
    const handleStepChange = (id) => {
        const next = id;
        setStep(next);
        // Entering the grid with no render yet kicks off generation.
        if (next === 'grid' && gridStage === 'idle')
            startGrid();
    };
    return (<div className="min-h-dvh bg-q-background-primary">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
        <step_rail_1.StepRail steps={STEPS.map(s => ({ id: s.id, label: s.label }))} current={step} reachable={reachable} onStepChange={handleStepChange}/>

        <main>
          {step === 'upload'
            ? <UploadStep source={source} onUpload={handleUpload} onGenerate={startGrid}/>
            : step === 'grid'
                ? (<GridStep source={source} stage={gridStage} selected={selected} onToggle={toggleSelect} onRegenerate={regenerate} onUpscale={goToUpscale}/>)
                : (<UpscaleStep stage={upscaleStage} tiles={selectedTiles.length > 0 ? selectedTiles : ANGLE_TILES.slice(0, 3)} onUpscale={startUpscale}/>)}
        </main>
      </div>
    </div>);
}
//# sourceMappingURL=shots.js.map