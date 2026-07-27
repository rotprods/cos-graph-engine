"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationDetailModal = GenerationDetailModal;
exports.GenerationDetailDemo = GenerationDetailDemo;
const react_1 = require("react");
const dialog_1 = require("@base-ui/react/dialog");
const download_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/download.svg?react"));
const share_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/share.svg?react"));
const keyboard_arrow_up_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/keyboard_arrow_up.svg?react"));
const info_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/info.svg?react"));
const cloud_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/cloud.svg?react"));
const close_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/close.svg?react"));
const more_horiz_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/more_horiz.svg?react"));
const favorite_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/favorite.svg?react"));
const videocam_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/videocam.svg?react"));
const avatar_1 = require("@higgsfield/quanta/avatar");
const button_1 = require("@higgsfield/quanta/button");
const glass_1 = require("@higgsfield/quanta/glass");
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const DEMO_GENERATION = {
    src: '/presets/how-product-works.png',
    mediaType: 'image',
    aspectRatio: 2 / 3,
    author: { name: 'retro_strawberry', role: 'Author' },
    status: 'Uploaded',
    fileType: 'JPG',
    size: '2.4 MB',
    uploadedAt: '12.05.2026, 01:22',
    lastUsedAt: '12.05.2026, 16:43',
    prompt: 'A model in a translucent floral raincoat standing beside pale horses in a windswept meadow, editorial fashion photography, soft daylight.',
};
/** A single "label ⋯ value" detail row. `value` may embed an icon/node. */
function DetailRow({ label, value }) {
    return (<div className="flex items-center gap-2">
      <typography_1.Typography as="span" variant="body-sm-regular" className="shrink-0 text-q-transparent-light-50">
        {label}
      </typography_1.Typography>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        {typeof value === 'string'
            ? (<typography_1.Typography as="span" variant="body-sm-regular" color="primary" truncate className="text-right">
                {value}
              </typography_1.Typography>)
            : value}
      </div>
    </div>);
}
function InfoPanel({ generation }) {
    const [detailsOpen, setDetailsOpen] = (0, react_1.useState)(true);
    const data = { ...DEMO_GENERATION, ...generation, author: { ...DEMO_GENERATION.author, ...generation.author } };
    return (<aside className="flex h-full w-full flex-col gap-2 p-2">
      {/* Author row */}
      <div className="flex items-center gap-2 p-1">
        <avatar_1.Avatar size="sm" src={data.author?.avatarSrc} alt={data.author?.name} color="mint"/>
        <div className="flex min-w-0 flex-1 flex-col">
          <typography_1.Typography as="span" variant="body-sm-medium" color="primary" truncate>
            {data.author?.name}
          </typography_1.Typography>
          <typography_1.Typography as="span" variant="caption-xs-regular" color="secondary" truncate>
            {data.author?.role ?? 'Author'}
          </typography_1.Typography>
        </div>
        <dialog_1.Dialog.Close aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-q-full bg-q-transparent-light-05 text-q-icon-primary transition-colors hover:bg-q-transparent-light-10">
          <icon_1.Icon as={close_svg_react_1.default} size="md"/>
        </dialog_1.Dialog.Close>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-2 rounded-q-300 bg-q-transparent-light-05 p-2">
        <button type="button" onClick={() => setDetailsOpen(o => !o)} className="flex items-center gap-2 px-1 py-1.5" aria-expanded={detailsOpen}>
          <icon_1.Icon as={info_svg_react_1.default} size="sm" color="secondary"/>
          <typography_1.Typography as="span" variant="label-xs-medium" color="secondary" className="flex-1 text-left uppercase">
            Details
          </typography_1.Typography>
          <icon_1.Icon as={keyboard_arrow_up_svg_react_1.default} size="sm" color="secondary" className={detailsOpen ? undefined : 'rotate-180'}/>
        </button>

        {detailsOpen
            ? (<>
                <div className="flex flex-col gap-1 rounded-q-200 bg-q-transparent-light-05 p-3">
                  <DetailRow label="Status" value={(<>
                        <icon_1.Icon as={cloud_svg_react_1.default} size="sm" color="secondary"/>
                        <typography_1.Typography as="span" variant="body-sm-regular" color="primary" truncate>
                          {data.status}
                        </typography_1.Typography>
                      </>)}/>
                  <DetailRow label="Type" value={data.fileType}/>
                  <DetailRow label="Size" value={data.size}/>
                  <DetailRow label="Uploaded" value={data.uploadedAt}/>
                  <DetailRow label="Last used" value={data.lastUsedAt}/>
                </div>

                <div className="flex flex-col gap-1 rounded-q-200 bg-q-transparent-light-05 p-3">
                  <typography_1.Typography as="span" variant="body-sm-regular" className="text-q-transparent-light-50">
                    Prompt
                  </typography_1.Typography>
                  <typography_1.Typography as="p" variant="body-sm-regular" color="primary">
                    {data.prompt}
                  </typography_1.Typography>
                </div>
              </>)
            : null}
      </div>

      <span aria-hidden className="flex-1"/>

      {/* Actions */}
      <div className="flex flex-col gap-2 p-2">
        <button_1.Button variant="marketingPrimary" size="sm" className="w-full" start={<icon_1.Icon as={videocam_svg_react_1.default} size="sm"/>}>
          Turn to video
        </button_1.Button>
        <div className="flex items-center gap-2">
          <button_1.Button variant="marketingTertiary" size="sm" className="flex-1" start={<icon_1.Icon as={download_svg_react_1.default} size="sm"/>}>
            Download
          </button_1.Button>
          <button_1.Button variant="marketingTertiary" size="sm" iconOnly aria-label="Like" start={<icon_1.Icon as={favorite_svg_react_1.default} size="sm"/>}/>
          <button_1.Button variant="marketingTertiary" size="sm" iconOnly aria-label="Share" start={<icon_1.Icon as={share_svg_react_1.default} size="sm"/>}/>
          <button_1.Button variant="marketingTertiary" size="sm" iconOnly aria-label="More" start={<icon_1.Icon as={more_horiz_svg_react_1.default} size="sm"/>}/>
        </div>
      </div>
    </aside>);
}
function GenerationDetailModal({ trigger, generation, open, onOpenChange, defaultOpen }) {
    const data = { ...DEMO_GENERATION, ...generation };
    // The stage frame takes the item's OWN aspect ratio and the media fills it
    // with `cover` — so the frame equals the image ratio and there are no
    // letterbox bars. The ratio-correct box is capped to the stage column by the
    // limiting axis: landscape/square is width-driven (q-media's default 100%
    // width), portrait is height-driven — either way max-h/max-w keep it inside
    // the column so it never overflows or slides under the info panel.
    const stageRatio = data.aspectRatio ?? 2 / 3;
    const stageFrameClass = stageRatio >= 1
        ? 'max-h-full max-w-full shadow-q-overlay'
        : 'h-full max-h-full w-auto! max-w-full shadow-q-overlay';
    return (<dialog_1.Dialog.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      <dialog_1.Dialog.Trigger render={trigger}/>
      <dialog_1.Dialog.Portal>
        <dialog_1.Dialog.Backdrop className="q-modal-backdrop"/>
        <dialog_1.Dialog.Popup aria-label="Generation preview" className="fixed inset-0 z-q-modal flex outline-none transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
          {/* Layer 1 — frosted media backdrop. A darker scrim (dark-80) + a heavy
          * backdrop blur so everything behind the crisp stage reads as a dark,
          * blurred frost. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-q-background-primary">
            <img src={data.src} alt="" className="absolute inset-0 size-full object-cover"/>
            <div className="absolute inset-0 bg-q-transparent-dark-80"/>
            <div className="absolute inset-0 backdrop-blur-3xl"/>
          </div>

          {/* Layer 2 — crisp stage. min-h-0/min-w-0 + overflow-hidden keep the
          * media inside this flex column so it never bleeds under the panel;
          * the frame carries the item's aspect ratio and the media covers it
          * (no letterbox bars), capped to the column by max-h-full/max-w-full. */}
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-6">
            {data.mediaType === 'video'
            ? (<media_1.Media ratio={stageRatio} rounded="md" className={stageFrameClass}>
                    <media_1.Media.Video src={data.src} poster={data.poster} autoPlayInView loop fit="cover"/>
                  </media_1.Media>)
            : (<media_1.Media ratio={stageRatio} rounded="md" className={stageFrameClass}>
                    <media_1.Media.Image src={data.src} alt="" fit="cover"/>
                  </media_1.Media>)}
          </div>

          {/* Layer 3 — info panel */}
          <div className="relative flex w-[366px] shrink-0 p-2">
            <div className={(0, glass_1.glass)({ blur: 'md', rounded: '500' }, 'flex min-h-0 flex-1 flex-col overflow-y-auto')}>
              <InfoPanel generation={generation ?? DEMO_GENERATION}/>
            </div>
          </div>
        </dialog_1.Dialog.Popup>
      </dialog_1.Dialog.Portal>
    </dialog_1.Dialog.Root>);
}
/**
 * Standalone demo — renders its own trigger button so the viewer can be
 * previewed without touching shared templates. Import into `main.tsx`
 * temporarily, or drop anywhere for a visual check.
 */
function GenerationDetailDemo() {
    return (<div className="flex min-h-screen items-center justify-center bg-q-background-primary p-8">
      <GenerationDetailModal trigger={<button_1.Button variant="primary" size="md">Open generation</button_1.Button>}/>
    </div>);
}
exports.default = GenerationDetailDemo;
//# sourceMappingURL=generation-detail.js.map