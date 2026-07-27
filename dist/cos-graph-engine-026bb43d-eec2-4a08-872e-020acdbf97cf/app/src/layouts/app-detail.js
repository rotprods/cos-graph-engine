"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDetailTemplate = AppDetailTemplate;
const react_1 = require("react");
const add_photo_alternate_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/add_photo_alternate.svg?react"));
const cloud_upload_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/cloud_upload.svg?react"));
const download_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/download.svg?react"));
const fullscreen_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/fullscreen.svg?react"));
const pets_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/pets.svg?react"));
const unfold_more_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/unfold_more.svg?react"));
const visibility_off_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/visibility_off.svg?react"));
const icon_sparkles_soft_svg_react_1 = __importDefault(require("@/assets/icon-sparkles-soft.svg?react"));
const button_1 = require("@higgsfield/quanta/button");
const card_1 = require("@higgsfield/quanta/card");
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const asset_library_1 = require("@/components/asset-library");
const dropzone_1 = require("@/components/dropzone");
const generation_card_1 = require("@/components/generation-card");
const template_modal_1 = require("@/components/template-modal");
/**
 * App-detail screen template (Figma Apps / Animal App, node 3309:86269). The
 * public landing page for a single Higgsfield "app": a two-column generator hero
 * (inputs on the left, a large preview on the right) and a "how it works in 3
 * steps" explainer. Quanta components + tokens only; the app-specific inputs
 * (`Dropzone`) are a small composition in `@/components`. No app header — the
 * Higgsfield host owns that.
 */
const HERO_PREVIEW = '/presets/cover.png';
/** The image shown once a (simulated) generation finishes. */
const HERO_RESULT = '/presets/explain.png';
const COVERS = [
    '/presets/how-product-works.png',
    '/presets/explain.png',
    '/presets/hyper-motion.png',
    '/presets/cover.png',
];
/** Animal presets offered by the "Select Animal" picker (Figma "All Presets"). */
const ANIMALS = [
    { id: 'deer', label: 'Deer', image: COVERS[3] },
    { id: 'dalmatian', label: 'Dalmatian', image: COVERS[0] },
    { id: 'raccoon', label: 'Raccoon', image: COVERS[1] },
    { id: 'lion', label: 'Lion', image: COVERS[2] },
    { id: 'fox', label: 'Fox', image: COVERS[3] },
    { id: 'panda', label: 'Panda', image: COVERS[0] },
    { id: 'owl', label: 'Owl', image: COVERS[1] },
    { id: 'tiger', label: 'Tiger', image: COVERS[2] },
];
const STEPS = [
    {
        title: 'Upload your image',
        description: 'Choose an image or drag and drop a file. Add a portrait, selfie, or any photo with a character.',
        preview: (<div className="flex h-full flex-col items-center justify-center gap-3 rounded-q-300 border border-dashed border-q-border-subtle px-8">
        <icon_1.Icon as={cloud_upload_svg_react_1.default} size="md" color="secondary"/>
        <div className="flex flex-col items-center gap-1 text-center">
          <typography_1.Typography as="span" variant="body-sm-semi-bold" color="primary" className="uppercase">
            Upload image or drag &amp; drop
          </typography_1.Typography>
          <typography_1.Typography as="span" variant="caption-xs-regular" color="secondary">
            PNG, JPG or Paste from clipboard
          </typography_1.Typography>
        </div>
      </div>),
    },
    {
        title: 'Press generate',
        description: 'Click the button and transform your photo according to the preset you\u2019re in.',
        preview: (<div className="flex h-full items-center justify-center">
        <button_1.Button variant="marketingPrimary" size="lg" start={<icon_sparkles_soft_svg_react_1.default width={18} height={18}/>}>
          Generate
        </button_1.Button>
      </div>),
    },
    {
        title: 'Get your result',
        description: 'Your image or video is ready! Download and enjoy the final result.',
        preview: (<div className="flex h-full items-center justify-center p-6">
        <media_1.Media ratio={3 / 4} rounded="md" className="h-full w-auto max-w-full ring-4 ring-white">
          <media_1.Media.Image src={COVERS[1]} alt="Generated result preview"/>
        </media_1.Media>
      </div>),
    },
];
/**
 * The finished-result card's on-hover controls (Figma node 3139:160610): two
 * glass buttons — Download + Full Screen — revealed at the bottom on hover /
 * keyboard focus. Composed into the `GenerationCard` frame via its `children`.
 */
function ResultHoverControls() {
    return (<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
      <button_1.Button variant="marketingTertiary" size="md" className="pointer-events-auto" start={<icon_1.Icon as={download_svg_react_1.default} size="sm"/>}>
        Download
      </button_1.Button>
      <button_1.Button variant="marketingTertiary" size="md" className="pointer-events-auto" start={<icon_1.Icon as={fullscreen_svg_react_1.default} size="sm"/>}>
        Full Screen
      </button_1.Button>
    </div>);
}
/** The generator hero — inputs on the left, a large preview on the right. */
function Hero() {
    // The two input tiles start EMPTY and flip to their filled preview once the
    // user picks an image (via AssetLibraryModal) or an animal (via TemplateModal).
    const [image, setImage] = (0, react_1.useState)(null);
    const [animal, setAnimal] = (0, react_1.useState)(null);
    // Right pane state machine: idle preview → generating (animated card) → result.
    // The transition is a simulated backend (no real job); the timer is created in
    // a handler and cleared on unmount, so nothing touches `window` during SSR.
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
        timerRef.current = setTimeout(() => setStage('result'), 2000);
    };
    return (<card_1.Card surface="solid" className="flex flex-col gap-2 rounded-q-600 border border-q-border-subtle p-2 lg:flex-row">
      <div className="flex flex-1 flex-col gap-8 px-4 py-5">
        <div className="flex flex-col gap-2">
          <typography_1.Typography as="h1" variant="accent-xl-bold" color="primary" className="uppercase">
            Animal App
          </typography_1.Typography>
          <typography_1.Typography as="p" variant="body-md-regular" color="secondary">
            Upload your photo and get images of you surrounded by animals.
          </typography_1.Typography>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-1 gap-3">
            <asset_library_1.AssetLibraryModal onSelect={item => setImage(item.src)} trigger={(<dropzone_1.Dropzone render={<button type="button"/>} icon={add_photo_alternate_svg_react_1.default} title="Upload Image" subtitle="PNG, JPG or Paste from Clipboard" preview={image != null
                ? <dropzone_1.DropzonePreview src={image} alt="Selected image"/>
                : undefined}/>)}/>
            <template_modal_1.TemplateModal title="Select Animal" options={ANIMALS} value={animal?.id} onSelect={setAnimal} trigger={(<dropzone_1.Dropzone render={<button type="button"/>} border="solid" icon={pets_svg_react_1.default} title="Select Animal" subtitle="Choose animals to appear around you" preview={animal != null
                ? <dropzone_1.DropzonePreview src={animal.image} alt={animal.label} label={animal.label} icon={pets_svg_react_1.default}/>
                : undefined}/>)}/>
          </div>

          <button_1.Button variant="marketingPrimary" size="lg" className="w-full" onClick={handleGenerate} end={<span className="flex items-center gap-2">
                <icon_sparkles_soft_svg_react_1.default width={18} height={18}/>
                <span className="text-q-body-lg-semi-bold">5</span>
              </span>}>
            Generate
          </button_1.Button>
        </div>
      </div>

      <div className="relative flex-1">
        {stage === 'generating'
            ? (<generation_card_1.GenerationCard state="generating" ratio={671 / 560} className="h-full w-full"/>)
            : stage === 'result'
                ? (<generation_card_1.GenerationCard ratio={671 / 560} src={HERO_RESULT} alt="Generated result — person surrounded by animals" className="group h-full w-full">
                  <ResultHoverControls />
                </generation_card_1.GenerationCard>)
                : (<media_1.Media ratio={671 / 560} rounded="md" className="h-full w-full">
                  <media_1.Media.Image src={HERO_PREVIEW} alt="Person surrounded by animals"/>
                  <media_1.Media.Overlay placement="center" className="pointer-events-none justify-center">
                    <span className="flex h-9 items-center rounded-q-full bg-q-transparent-dark-40 px-1 text-q-icon-inverse backdrop-blur-sm">
                      <icon_1.Icon as={unfold_more_svg_react_1.default} size="sm" className="rotate-90"/>
                    </span>
                  </media_1.Media.Overlay>
                </media_1.Media>)}
      </div>
    </card_1.Card>);
}
/** "How it works in 3 steps" explainer row. */
function Steps() {
    return (<section className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <typography_1.Typography as="h2" variant="accent-lg-bold" color="primary" className="uppercase">
          How it works
          {' '}
          <span className="text-q-text-brand">in 3 steps</span>
        </typography_1.Typography>
        <button_1.Button variant="tertiary" size="sm" start={<icon_1.Icon as={visibility_off_svg_react_1.default} size="sm"/>}>
          Hide tip
        </button_1.Button>
      </header>

      <div className="grid gap-10 md:grid-cols-3">
        {STEPS.map((step, index) => (<div key={step.title} className="flex flex-col gap-4">
            <div className="h-60 overflow-hidden rounded-q-400 bg-q-background-secondary">
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
    </section>);
}
function AppDetailTemplate() {
    return (<div className="min-h-dvh bg-q-background-primary">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-6 md:px-8 md:py-8">
        <Hero />
        <Steps />
      </div>
    </div>);
}
//# sourceMappingURL=app-detail.js.map