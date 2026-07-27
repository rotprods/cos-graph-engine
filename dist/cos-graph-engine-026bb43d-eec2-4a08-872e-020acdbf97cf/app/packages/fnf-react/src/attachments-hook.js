"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAttachments = useAttachments;
const react_1 = require("react");
const attachments_1 = require("./attachments");
const external_store_hook_1 = require("./external-store-hook");
const provider_1 = require("./provider");
/**
 * An attachments presenter bound to the component: previews render
 * immediately, uploads run in the background, `refs`/`settled()` feed the
 * submit. Object URLs are revoked on unmount. For an attachments list that
 * must outlive the component (route changes, pools), construct
 * `AttachmentsController` yourself and bind it with `useStore`.
 *
 *   const attachments = useAttachments(media, { upload: { forceIpCheck: true } })
 *   <input type="file" onChange={e => attachments.add([...e.target.files ?? []])} />
 *   {attachments.items.map(a => <Thumb key={a.key} src={a.previewUrl} state={a.status} />)}
 *   <button onClick={async () => submit(await attachments.settled())} />
 */
function useAttachments(media, opts) {
    const providerObservability = (0, provider_1.useOptionalFnfObservability)();
    const observability = opts?.observability ?? providerObservability;
    // useState, not useMemo: items live in the controller; a cache-discard
    // would wipe them. `media` and `opts` are read once — both must be stable.
    const [controller] = (0, react_1.useState)(() => new attachments_1.AttachmentsController(media, { ...opts, ...(observability ? { observability } : {}) }));
    (0, react_1.useEffect)(() => () => controller.dispose(), [controller]);
    return (0, external_store_hook_1.useStore)(controller);
}
//# sourceMappingURL=attachments-hook.js.map