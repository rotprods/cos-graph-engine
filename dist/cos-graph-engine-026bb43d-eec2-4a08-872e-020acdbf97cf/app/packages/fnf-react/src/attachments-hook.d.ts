import type { AttachmentsMediaClient, AttachmentsOptions } from './attachments';
import { AttachmentsController } from './attachments';
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
export declare function useAttachments(media: AttachmentsMediaClient, opts?: AttachmentsOptions): AttachmentsController;
//# sourceMappingURL=attachments-hook.d.ts.map