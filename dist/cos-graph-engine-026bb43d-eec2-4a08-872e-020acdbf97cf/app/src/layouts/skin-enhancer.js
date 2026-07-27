"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkinEnhancerTemplate = SkinEnhancerTemplate;
const react_1 = require("react");
const add_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/add.svg?react"));
const cloud_upload_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/cloud_upload.svg?react"));
const compare_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/compare.svg?react"));
const download_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/download.svg?react"));
const fullscreen_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/fullscreen.svg?react"));
const refresh_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/refresh.svg?react"));
const tune_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/tune.svg?react"));
const upload_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/upload.svg?react"));
const icon_sparkles_soft_svg_react_1 = __importDefault(require("@/assets/icon-sparkles-soft.svg?react"));
const button_1 = require("@higgsfield/quanta/button");
const card_1 = require("@higgsfield/quanta/card");
const icon_1 = require("@higgsfield/quanta/icon");
const loader_1 = require("@higgsfield/quanta/loader");
const media_1 = require("@higgsfield/quanta/media");
const select_1 = require("@higgsfield/quanta/select");
const typography_1 = require("@higgsfield/quanta/typography");
const asset_library_1 = require("@/components/asset-library");
const before_after_compare_1 = require("@/components/before-after-compare");
const generation_card_1 = require("@/components/generation-card");
const generation_detail_1 = require("@/components/generation-detail");
const history_grid_1 = require("@/components/history-grid");
const setting_trigger_1 = require("@/components/setting-trigger");
/**
 * Skin Enhancer app template — modeled on the live Higgsfield "Skin Enhancer"
 * app (https://higgsfield.ai/apps/skin-enhancer). The real page centers on a
 * single card: a before/after comparison slider (original ↔ enhanced) over the
 * "SKIN ENHANCER" title, a one-line subtitle, and a white "Upload Media" CTA,
 * with an "Apps / Skin Enhancer" breadcrumb and a floating "+" rail on the left.
 *
 * Rebuilt entirely in our design system (Quanta components + `q-` tokens + our
 * shared `@/components/*`): the compare interaction is the new
 * `@/components/before-after-compare`; uploads open the shared
 * `AssetLibraryModal`; the busy state is `<GenerationCard state="generating" />`;
 * opening a result uses `GenerationDetailModal`; personal history is the shared
 * `HistoryGrid`. Permanently dark, no app header (the Higgsfield host owns it).
 *
 * Flow: idle demo compare → Upload Media → pick enhancement strength → Enhance
 * → generating → before/after result (+ full-screen detail) → personal history.
 */
/** Demo assets standing in for a real portrait / enhanced pair. */
const DEMO_BEFORE = '/presets/cover.png';
const DEMO_AFTER = '/presets/how-product-works.png';
/** The (simulated) enhanced output shown once a generation finishes. */
const ENHANCED_RESULT = '/presets/explain.png';
/** Credit cost surfaced inside the Enhance CTA. */
const ENHANCE_COST = 4;
const STRENGTHS = [
    { value: 'subtle', title: 'Subtle', subtitle: 'Light retouch, keeps texture' },
    { value: 'balanced', title: 'Balanced', subtitle: 'Even skin, natural look' },
    { value: 'strong', title: 'Strong', subtitle: 'Maximum smoothing' },
];
const STEPS = [
    {
        title: 'Upload your portrait',
        description: 'Add a selfie or portrait — a clear, well-lit face gives the best enhancement.',
        icon: cloud_upload_svg_react_1.default,
    },
    {
        title: 'Pick a strength & enhance',
        description: 'Choose how much to retouch, then press Enhance to refine skin texture and tone.',
        icon: tune_svg_react_1.default,
    },
    {
        title: 'Compare & download',
        description: 'Drag the slider to compare original and enhanced, then download your result.',
        icon: compare_svg_react_1.default,
    },
];
/** Shared popup placement for the strength picker. */
const PICKER_POPUP = {
    size: 'picker',
    surface: 'solid',
    side: 'bottom',
    align: 'start',
    sideOffset: 8,
    collisionPadding: 16,
};
/** Enhancement-strength picker — two-line options behind a `SettingTrigger` row. */
function StrengthSelect() {
    return (<select_1.Select.Root defaultValue="balanced">
      <select_1.Select.Trigger bare render={<setting_trigger_1.SettingTrigger label="Enhancement"/>}>
        <select_1.Select.Value placeholder="Select strength"/>
      </select_1.Select.Trigger>
      <select_1.Select.Content {...PICKER_POPUP}>
        {STRENGTHS.map(strength => (<select_1.Select.Item key={strength.value} value={strength.value}>
            <select_1.Select.ItemContent>
              <select_1.Select.ItemText>{strength.title}</select_1.Select.ItemText>
              <select_1.Select.ItemDescription>{strength.subtitle}</select_1.Select.ItemDescription>
            </select_1.Select.ItemContent>
            <select_1.Select.ItemIndicator />
          </select_1.Select.Item>))}
      </select_1.Select.Content>
    </select_1.Select.Root>);
}
/** The Enhance generation CTA — marketing primary, cost shown as `{label} {✦} {credits}`. */
function EnhanceButton({ busy, onClick }) {
    return (<button_1.Button variant="marketingPrimary" size="lg" className="w-full" disabled={busy} onClick={onClick} start={busy ? <loader_1.Loader size="xs" color="neutral"/> : undefined} end={busy
            ? undefined
            : (<span className="flex items-center gap-2">
              <icon_sparkles_soft_svg_react_1.default width={14} height={14}/>
              <span className="text-q-body-md-semi-bold">{ENHANCE_COST}</span>
            </span>)}>
      {busy ? 'Enhancing' : 'Enhance'}
    </button_1.Button>);
}
/** The centered generator card — the app's hero, mirroring the live page. */
function EnhancerCard() {
    // The portrait picked from the shared AssetLibraryModal.
    const [image, setImage] = (0, react_1.useState)(null);
    const [stage, setStage] = (0, react_1.useState)('idle');
    const timerRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => () => {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
    }, []);
    const handleUpload = (item) => {
        setImage(item);
        setStage('ready');
    };
    const handleEnhance = () => {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
        setStage('generating');
        timerRef.current = setTimeout(() => setStage('result'), 2200);
    };
    const handleReset = () => {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
        setImage(null);
        setStage('idle');
    };
    const beforeSrc = image?.src ?? DEMO_BEFORE;
    return (<card_1.Card surface="solid" className="flex w-full max-w-md flex-col items-center gap-6 rounded-q-600 border border-dashed border-q-border-subtle p-6 md:p-8">
      {/* Visual — demo compare / uploaded portrait / generating / result compare. */}
      <div className="w-full max-w-70">
        {stage === 'idle'
            ? (<before_after_compare_1.BeforeAfterCompare beforeSrc={DEMO_BEFORE} afterSrc={DEMO_AFTER} beforeAlt="Original portrait" afterAlt="Enhanced portrait" ratio={4 / 5}/>)
            : stage === 'ready'
                ? (<media_1.Media ratio={4 / 5} rounded="md" className="w-full">
                  <media_1.Media.Image src={beforeSrc} alt={image?.name ?? 'Your portrait'}/>
                </media_1.Media>)
                : stage === 'generating'
                    ? <generation_card_1.GenerationCard state="generating" ratio={4 / 5} generatingLabel="Enhancing" className="w-full"/>
                    : (<before_after_compare_1.BeforeAfterCompare beforeSrc={beforeSrc} afterSrc={ENHANCED_RESULT} beforeAlt="Your original portrait" afterAlt="Enhanced portrait" beforeLabel="Original" afterLabel="Enhanced" ratio={4 / 5}/>)}
      </div>

      {/* Title + subtitle — always present, like the live hero. */}
      <div className="flex flex-col items-center gap-2 text-center">
        <typography_1.Typography as="h1" variant="accent-xl-bold" color="primary" className="uppercase">
          Skin Enhancer
        </typography_1.Typography>
        <typography_1.Typography as="p" variant="body-md-regular" color="secondary">
          Upload your images to enhance skin texture and quality.
        </typography_1.Typography>
      </div>

      {/* Action zone — swaps with the lifecycle stage. */}
      <div className="flex w-full flex-col gap-3">
        {stage === 'idle'
            ? (<asset_library_1.AssetLibraryModal onSelect={handleUpload} trigger={(<button_1.Button variant="secondary" size="lg" className="w-full" start={<icon_1.Icon as={upload_svg_react_1.default} size="sm"/>}>
                    Upload Media
                  </button_1.Button>)}/>)
            : stage === 'result'
                ? (<>
                  <div className="flex gap-2">
                    <button_1.Button variant="marketingTertiary" size="lg" className="flex-1" start={<icon_1.Icon as={download_svg_react_1.default} size="sm"/>}>
                      Download
                    </button_1.Button>
                    <generation_detail_1.GenerationDetailModal generation={{
                        src: ENHANCED_RESULT,
                        mediaType: 'image',
                        aspectRatio: 4 / 5,
                        fileType: 'JPG',
                        prompt: 'Skin enhancement — even tone, refined texture, natural retouch.',
                    }} trigger={(<button_1.Button variant="marketingTertiary" size="lg" iconOnly aria-label="Open full screen" start={<icon_1.Icon as={fullscreen_svg_react_1.default} size="sm"/>}/>)}/>
                  </div>
                  <button_1.Button variant="ghost" size="md" className="w-full" onClick={handleReset} start={<icon_1.Icon as={refresh_svg_react_1.default} size="sm"/>}>
                    Enhance another photo
                  </button_1.Button>
                </>)
                : (
                // ready / generating — strength picker + Enhance CTA.
                <>
                  <StrengthSelect />
                  <EnhanceButton busy={stage === 'generating'} onClick={handleEnhance}/>
                  {stage === 'ready'
                        ? (<asset_library_1.AssetLibraryModal onSelect={handleUpload} trigger={(<button_1.Button variant="ghost" size="sm" className="w-full" start={<icon_1.Icon as={upload_svg_react_1.default} size="sm"/>}>
                              Change photo
                            </button_1.Button>)}/>)
                        : null}
                </>)}
      </div>
    </card_1.Card>);
}
/** Left rail — a floating "+" that opens the asset library (mirrors the live page). */
function AddRail() {
    return (<aside className="hidden shrink-0 md:block">
      <asset_library_1.AssetLibraryModal trigger={(<button type="button" aria-label="Add media" className={(0, card_1.card)({ surface: 'solid' }, 'flex size-14 items-center justify-center rounded-q-250 border border-q-border-subtle text-q-icon-secondary transition-colors hover:border-q-border-strong hover:text-q-icon-primary focus-visible:outline-2 focus-visible:outline-q-border-focus')}>
            <icon_1.Icon as={add_svg_react_1.default} size="md"/>
          </button>)}/>
    </aside>);
}
/** "How it works in 3 steps" explainer row. */
function Steps() {
    return (<section className="flex flex-col gap-8">
      <typography_1.Typography as="h2" variant="accent-lg-bold" color="primary" className="uppercase">
        How it works
        {' '}
        <span className="text-q-text-brand">in 3 steps</span>
      </typography_1.Typography>
      <div className="grid gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (<div key={step.title} className="flex flex-col gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-q-400 bg-q-background-secondary">
              <icon_1.Icon as={step.icon} size="md" color="secondary"/>
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
/** Personal history — the current user's own enhancements, via the shared grid. */
function History() {
    return (<section className="flex flex-col gap-6">
      <typography_1.Typography as="h2" variant="accent-lg-bold" color="primary" className="uppercase">
        Your enhancements
      </typography_1.Typography>
      <history_grid_1.HistoryGrid />
    </section>);
}
function SkinEnhancerTemplate() {
    return (<div className="min-h-dvh bg-q-background-primary">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-6 md:px-8 md:py-8">
        {/* Hero — floating "+" rail beside the centered generator card. */}
        <div className="flex justify-center gap-6">
          <AddRail />
          <EnhancerCard />
          {/* Spacer mirrors the rail width so the card stays visually centered. */}
          <div aria-hidden className="hidden w-14 shrink-0 md:block"/>
        </div>

        <Steps />
        <History />
      </div>
    </div>);
}
//# sourceMappingURL=skin-enhancer.js.map