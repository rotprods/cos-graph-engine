"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsController = void 0;
const errors_1 = require("@higgsfield/fnf/errors");
const media_1 = require("@higgsfield/fnf/media");
const observability_1 = require("@higgsfield/fnf/observability");
const external_store_1 = require("./external-store");
/**
 * The attachments presenter: files in → previews now, uploads in flight,
 * submit-ready `MediaRef`s out. The frontend counterpart of fnf-web's
 * `InputMediaController`, rebuilt on the SDK media client:
 *
 *   const refs = await attachments.settled()       // wait out in-flight uploads
 *   client.submit({ media: { image: refs }, ... })
 *
 * Per-item lifecycle: `uploading` → `ready` | `blocked` (moderation verdict,
 * kept visible instead of thrown) | `failed` (typed error, `retry`-able).
 * Removing an in-flight item aborts its upload; object URLs are revoked when
 * the remote url takes over and on remove/clear/dispose. No counts, types,
 * or roles are restricted here — the job declarations validate media; the
 * presenter only presents.
 */
class AttachmentsController extends external_store_1.ExternalStore {
    media;
    opts;
    _items = [];
    inFlight = new Set();
    localUrls = new Map();
    aborts = new Map();
    uploadOpts = new Map();
    measure = (0, media_1.createDomMediaMetaResolver)();
    observability;
    seq = 0;
    constructor(media, opts = {}) {
        super();
        this.media = media;
        this.opts = opts;
        this.observability = (0, observability_1.createObservabilityContext)(opts.observability);
    }
    get items() {
        return this._items;
    }
    /** Submit-ready refs (ready items only, in display order). */
    get refs() {
        return this._items.flatMap(item => item.status === 'ready' && item.ref ? [item.ref] : []);
    }
    get isUploading() {
        return this._items.some(item => item.status === 'uploading');
    }
    /**
     * Add files (uploaded immediately, preview available at once) or
     * already-uploaded refs (ready as-is). `opts` are upload options for THESE
     * entries, merged over the controller-wide ones (`role` lives here too).
     * Returns the new items' keys.
     */
    add(input, opts) {
        const entries = Array.isArray(input) ? input : [input];
        const keys = [];
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.add', {
            item_count: entries.length,
            file_count: entries.filter(entry => entry instanceof File).length,
            ref_count: entries.filter(entry => !(entry instanceof File)).length,
            ...(opts?.role ?? this.opts.upload?.role ? { role: opts?.role ?? this.opts.upload?.role ?? null } : {}),
        });
        for (const entry of entries) {
            const key = `att-${++this.seq}`;
            keys.push(key);
            if (entry instanceof File) {
                const previewUrl = this.createLocalUrl(key, entry);
                this._items = [...this._items, { key, file: entry, role: opts?.role ?? this.opts.upload?.role, previewUrl, status: 'uploading' }];
                this.uploadOpts.set(key, opts);
                this.track(this.upload(key, entry, opts));
            }
            else {
                this._items = [...this._items, { key, ref: entry, role: entry.role ?? opts?.role, previewUrl: entry.url, status: 'ready' }];
            }
        }
        this.commit();
        return keys;
    }
    /** Re-upload a failed file-born attachment with its original options. */
    retry(key) {
        const item = this._items.find(i => i.key === key);
        if (!item || item.status !== 'failed' || !item.file)
            return;
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.retry', { attachment_key: key });
        this.patch(key, { status: 'uploading', error: undefined });
        this.track(this.upload(key, item.file, this.uploadOpts.get(key)));
    }
    /** Remove the item; an in-flight upload is aborted. */
    remove(key) {
        const item = this._items.find(entry => entry.key === key);
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.remove', {
            attachment_key: key,
            ...(item ? { status: item.status } : {}),
        });
        this.aborts.get(key)?.abort();
        this.aborts.delete(key);
        this.uploadOpts.delete(key);
        this.revokeLocalUrl(key);
        this._items = this._items.filter(item => item.key !== key);
        this.commit();
    }
    /** Reorder (drag-and-drop): move the item at `from` to position `to`. */
    move(from, to) {
        if (from === to || from < 0 || to < 0 || from >= this._items.length || to >= this._items.length)
            return;
        const next = [...this._items];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        this._items = next;
        this.commit();
    }
    clear() {
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.clear', { item_count: this._items.length });
        for (const controller of this.aborts.values())
            controller.abort();
        this.aborts.clear();
        this.uploadOpts.clear();
        for (const key of [...this.localUrls.keys()])
            this.revokeLocalUrl(key);
        this._items = [];
        this.commit();
    }
    /** `clear` + drop in-flight bookkeeping — call when the owner unmounts. */
    dispose() {
        this.clear();
        this.inFlight.clear();
    }
    /**
     * Wait for every in-flight upload to finish, then return the submit-ready
     * refs — the "user hit Generate while uploads are running" path. Failures
     * don't reject; they stay visible as `failed`/`blocked` items.
     */
    async settled() {
        while (this.inFlight.size > 0)
            await Promise.allSettled([...this.inFlight]);
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.settled', {
            item_count: this._items.length,
            ready_count: this.refs.length,
        });
        return this.refs;
    }
    async upload(key, file, opts) {
        const abort = new AbortController();
        this.aborts.set(key, abort);
        // Measure from the local preview in parallel with the upload. The File's
        // mime drives the kind (a blob URL has no extension to sniff); the
        // resolver caches per url and resolves undefined outside a DOM. Best
        // effort by contract: a measurement failure must never fail the upload.
        const previewUrl = this.localUrls.get(key);
        const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.upload_start', {
            attachment_key: key,
            media_type: kind,
            ...(opts?.role ?? this.opts.upload?.role ? { role: opts?.role ?? this.opts.upload?.role ?? null } : {}),
        });
        const measured = this.opts.measure === false || !previewUrl
            ? Promise.resolve(undefined)
            : this.measure({ id: key, type: kind, url: previewUrl }).catch(() => undefined);
        try {
            const result = await this.media.upload({
                source: file,
                filename: file.name,
                contentType: file.type || undefined,
                throwOnModeration: false, // verdicts become item state, not throws
                signal: abort.signal,
                ...this.opts.upload,
                ...opts,
            });
            const meta = await measured;
            const ref = { ...result.ref, ...(meta ? { meta } : {}) };
            if (result.moderation && (0, media_1.isBlockedModeration)(result.moderation.status)) {
                // keep the local preview — a blocked upload has no usable remote url
                (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.blocked', {
                    attachment_key: key,
                    media_id: result.mediaId,
                    moderation_status: result.moderation.status,
                });
                this.patch(key, { ref, status: 'blocked', moderation: result.moderation });
                return;
            }
            if (ref.url)
                this.revokeLocalUrl(key);
            (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.ready', {
                attachment_key: key,
                media_id: result.mediaId,
                media_type: result.type,
                status: result.status,
            });
            this.patch(key, { ref, status: 'ready', previewUrl: ref.url ?? this.localUrls.get(key), moderation: result.moderation });
        }
        catch (err) {
            const error = err instanceof errors_1.ApiJobError ? err : new errors_1.ApiJobError('unexpected', err instanceof Error ? err.message : String(err));
            (0, observability_1.observeEvent)(this.observability, 'fnf.react.attachments.failed', {
                attachment_key: key,
                error_code: error.code,
                ...(error.status !== undefined ? { error_status: error.status } : {}),
            });
            this.patch(key, { status: 'failed', error });
        }
        finally {
            if (this.aborts.get(key) === abort)
                this.aborts.delete(key);
        }
    }
    track(promise) {
        this.inFlight.add(promise);
        void promise.finally(() => this.inFlight.delete(promise));
    }
    patch(key, changes) {
        const at = this._items.findIndex(item => item.key === key);
        if (at < 0)
            return; // removed while uploading — drop the result
        this._items = [...this._items.slice(0, at), { ...this._items[at], ...changes }, ...this._items.slice(at + 1)];
        this.commit();
    }
    createLocalUrl(key, file) {
        if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function')
            return undefined;
        const url = URL.createObjectURL(file);
        this.localUrls.set(key, url);
        return url;
    }
    revokeLocalUrl(key) {
        const url = this.localUrls.get(key);
        if (url === undefined)
            return;
        this.localUrls.delete(key);
        URL.revokeObjectURL(url);
    }
}
exports.AttachmentsController = AttachmentsController;
//# sourceMappingURL=attachments.js.map