"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const attachments_1 = require("../attachments");
function fakeMedia(respond) {
    const uploads = [];
    let release;
    const gate = new Promise(resolve => (release = resolve));
    const media = {
        async upload(input) {
            uploads.push(input);
            await gate;
            const out = respond?.(input);
            if (out instanceof Error)
                throw out;
            return {
                ref: { id: `m${uploads.length}`, type: 'media_input', url: `https://cdn/m${uploads.length}.png`, ...(input.role ? { role: input.role } : {}) },
                mediaId: `m${uploads.length}`,
                status: 'uploaded',
                type: 'image',
                contentType: 'image/png',
                filename: String(input.filename ?? 'x.png'),
                ...out,
            };
        },
    };
    return { media, uploads, release: () => release?.() };
}
const file = (name = 'cat.png') => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
(0, vitest_1.describe)('AttachmentsController', () => {
    (0, vitest_1.it)('files preview immediately, upload in background, and become submit-ready refs', async () => {
        const { media, uploads, release } = fakeMedia();
        const attachments = new attachments_1.AttachmentsController(media, { upload: { forceIpCheck: true }, measure: false });
        const [key] = attachments.add(file(), { role: 'start_image' });
        (0, vitest_1.expect)(attachments.items[0]).toMatchObject({ key, status: 'uploading' });
        (0, vitest_1.expect)(attachments.isUploading).toBe(true);
        (0, vitest_1.expect)(attachments.refs).toEqual([]); // not ready yet
        release();
        const refs = await attachments.settled();
        (0, vitest_1.expect)(uploads[0]).toMatchObject({ filename: 'cat.png', role: 'start_image', forceIpCheck: true, throwOnModeration: false });
        (0, vitest_1.expect)(refs).toHaveLength(1);
        (0, vitest_1.expect)(attachments.items[0]).toMatchObject({ status: 'ready', previewUrl: 'https://cdn/m1.png' });
    });
    (0, vitest_1.it)('already-uploaded refs are ready as-is; order is presentational (move)', () => {
        const { media } = fakeMedia();
        const attachments = new attachments_1.AttachmentsController(media);
        attachments.add({ id: 'r1', type: 'media_input', url: 'https://cdn/r1.png' });
        attachments.add({ id: 'r2', type: 'media_input', url: 'https://cdn/r2.png' });
        attachments.move(1, 0);
        (0, vitest_1.expect)(attachments.refs.map(r => r.id)).toEqual(['r2', 'r1']);
    });
    (0, vitest_1.it)('a moderation verdict becomes a blocked item, not a throw', async () => {
        const { media, release } = fakeMedia(() => ({ status: 'ip_detected', moderation: { status: 'ip_detected' } }));
        const attachments = new attachments_1.AttachmentsController(media, { measure: false });
        attachments.add(file());
        release();
        const refs = await attachments.settled();
        (0, vitest_1.expect)(refs).toEqual([]); // blocked items never feed a submit
        (0, vitest_1.expect)(attachments.items[0]).toMatchObject({ status: 'blocked', moderation: { status: 'ip_detected' } });
    });
    (0, vitest_1.it)('retry keeps the original role and options', async () => {
        let attempts = 0;
        const { media, uploads, release } = fakeMedia(() => (attempts++ === 0 ? new Error('boom') : {}));
        const attachments = new attachments_1.AttachmentsController(media, { measure: false });
        const [key] = attachments.add(file(), { role: 'start_image', forceIpCheck: true });
        release();
        await attachments.settled();
        attachments.retry(key);
        await attachments.settled();
        (0, vitest_1.expect)(uploads[1]).toMatchObject({ role: 'start_image', forceIpCheck: true }); // not dropped on retry
        (0, vitest_1.expect)(attachments.items[0].role).toBe('start_image');
    });
    (0, vitest_1.it)('removing an in-flight item aborts its upload signal', async () => {
        let seenSignal;
        const { media, release } = fakeMedia();
        const wrapped = {
            async upload(input) {
                seenSignal = input.signal;
                return media.upload(input);
            },
        };
        const attachments = new attachments_1.AttachmentsController(wrapped, { measure: false });
        const [key] = attachments.add(file());
        attachments.remove(key);
        release();
        await attachments.settled();
        (0, vitest_1.expect)(seenSignal?.aborted).toBe(true);
    });
    (0, vitest_1.it)('a failed upload carries the typed error and is retryable', async () => {
        let attempts = 0;
        const { media, release } = fakeMedia(() => (attempts++ === 0 ? new Error('socket hang up') : {}));
        const attachments = new attachments_1.AttachmentsController(media, { measure: false });
        const [key] = attachments.add(file());
        release();
        await attachments.settled();
        (0, vitest_1.expect)(attachments.items[0]).toMatchObject({ status: 'failed', error: { code: 'unexpected', message: 'socket hang up' } });
        attachments.retry(key);
        const refs = await attachments.settled();
        (0, vitest_1.expect)(refs).toHaveLength(1);
        (0, vitest_1.expect)(attachments.items[0].status).toBe('ready');
    });
    (0, vitest_1.it)('removing an item mid-upload drops the late result', async () => {
        const { media, release } = fakeMedia();
        const attachments = new attachments_1.AttachmentsController(media, { measure: false });
        const [key] = attachments.add(file());
        attachments.remove(key);
        release();
        const refs = await attachments.settled();
        (0, vitest_1.expect)(refs).toEqual([]);
        (0, vitest_1.expect)(attachments.items).toEqual([]);
    });
    (0, vitest_1.it)('emits safe observability events for attachment lifecycle', async () => {
        const events = [];
        const { media, release } = fakeMedia();
        const attachments = new attachments_1.AttachmentsController(media, {
            measure: false,
            observability: {
                observer: (event) => {
                    events.push(event);
                },
            },
        });
        attachments.add(file('private-cat.png'), { role: 'start_image' });
        release();
        await attachments.settled();
        attachments.clear();
        (0, vitest_1.expect)(events.map(event => event.name)).toEqual(vitest_1.expect.arrayContaining([
            'fnf.react.attachments.add',
            'fnf.react.attachments.upload_start',
            'fnf.react.attachments.ready',
            'fnf.react.attachments.settled',
            'fnf.react.attachments.clear',
        ]));
        (0, vitest_1.expect)(JSON.stringify(events)).not.toContain('private-cat.png');
        (0, vitest_1.expect)(JSON.stringify(events)).not.toContain('https://cdn/');
    });
});
(0, vitest_1.describe)('AttachmentsController — the measure path (default on)', () => {
    /** Stub the structural DOM the SDK resolver probes; `loads` scripts the attempts. */
    function stubDom(loads) {
        const attempts = { count: 0 };
        class FakeImage {
            naturalWidth = 800;
            naturalHeight = 600;
            onload = null;
            onerror = null;
            #src = '';
            get src() {
                return this.#src;
            }
            set src(value) {
                this.#src = value;
                const ok = loads[Math.min(attempts.count++, loads.length - 1)];
                queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()));
            }
        }
        ;
        globalThis.Image = FakeImage;
        globalThis.document = { createElement: () => ({}) };
        return {
            attempts,
            restore: () => {
                delete globalThis.Image;
                delete globalThis.document;
            },
        };
    }
    (0, vitest_1.it)('measured intrinsic size lands on the submit-ready ref', async () => {
        const dom = stubDom([true]);
        try {
            const { media, release } = fakeMedia();
            const attachments = new attachments_1.AttachmentsController(media);
            attachments.add(file());
            release();
            const refs = await attachments.settled();
            (0, vitest_1.expect)(refs[0].meta).toEqual({ width: 800, height: 600 });
        }
        finally {
            dom.restore();
        }
    });
    (0, vitest_1.it)('a failed measurement NEVER fails a successful upload — ready, just without meta', async () => {
        const dom = stubDom([false]); // e.g. a PDF mislabeled as image, a broken codec
        try {
            const { media, release } = fakeMedia();
            const attachments = new attachments_1.AttachmentsController(media);
            attachments.add(file());
            release();
            const refs = await attachments.settled();
            (0, vitest_1.expect)(attachments.items[0].status).toBe('ready');
            (0, vitest_1.expect)(refs).toHaveLength(1);
            (0, vitest_1.expect)(refs[0].meta).toBeUndefined();
        }
        finally {
            dom.restore();
        }
    });
    (0, vitest_1.it)('retry after a failed upload re-measures instead of replaying a cached failure', async () => {
        const dom = stubDom([false, true]);
        try {
            let uploadAttempts = 0;
            const { media, release } = fakeMedia(() => (uploadAttempts++ === 0 ? new Error('boom') : {}));
            const attachments = new attachments_1.AttachmentsController(media);
            const [key] = attachments.add(file());
            release();
            await attachments.settled();
            (0, vitest_1.expect)(attachments.items[0].status).toBe('failed');
            attachments.retry(key);
            const refs = await attachments.settled();
            (0, vitest_1.expect)(attachments.items[0].status).toBe('ready');
            (0, vitest_1.expect)(refs[0].meta).toEqual({ width: 800, height: 600 }); // the second measurement, not the poisoned first
        }
        finally {
            dom.restore();
        }
    });
});
//# sourceMappingURL=attachments.test.js.map