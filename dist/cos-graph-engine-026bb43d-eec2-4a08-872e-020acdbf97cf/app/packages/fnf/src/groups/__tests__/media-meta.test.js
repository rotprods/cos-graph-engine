"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const media_meta_1 = require("../../media-meta");
const media_1 = require("../media");
function ref(id, meta) {
    return { id, type: 'media_input', url: `https://cdn/${id}.png`, ...(meta ? { meta } : {}) };
}
const CFG = {
    field: 'medias',
    format: 'wrapped',
    roles: ['image', 'start_image', 'video', 'audio'],
    rules: [
        (0, media_1.dimensionsWithin)(['image', 'start_image'], { minSide: 300, maxSide: 6000, ratio: [0.4, 2.5] }),
        (0, media_1.dimensionsWithin)(['video'], { minSide: 300, maxSide: 6000, minPixels: 409_600, ratio: [0.4, 2.5] }),
        (0, media_1.durationsWithin)(['video', 'audio'], { each: [2, 15], total: 15 }),
    ],
};
(0, vitest_1.describe)('dimensionsWithin', () => {
    (0, vitest_1.it)('flags too-small / too-large / off-ratio refs with human labels', () => {
        const issues = (0, media_1.checkMedia)(CFG, {
            image: [ref('ok', { width: 1024, height: 1024 }), ref('tiny', { width: 100, height: 400 })],
            start_image: [ref('wide', { width: 3000, height: 1000 })],
        });
        (0, vitest_1.expect)(issues.map(i => i.msg)).toEqual([
            'Image 2 is too small — the minimum dimension is 300px',
            'Start image aspect ratio must be between 0.4 and 2.5',
        ]);
    });
    (0, vitest_1.it)('checks the pixel floor only where declared (videos, not images)', () => {
        // 500×500 = 250k pixels: fine as an image, below the 409.6k video floor
        (0, vitest_1.expect)((0, media_1.checkMedia)(CFG, { image: [ref('a', { width: 500, height: 500 })] })).toEqual([]);
        const issues = (0, media_1.checkMedia)(CFG, { video: [ref('v', { width: 500, height: 500 })] });
        (0, vitest_1.expect)(issues[0].msg).toContain('resolution is too low');
    });
    (0, vitest_1.it)('skips refs without meta — local knowledge is optional', () => {
        (0, vitest_1.expect)((0, media_1.checkMedia)(CFG, { image: [ref('unknown')] })).toEqual([]);
    });
});
(0, vitest_1.describe)('durationsWithin', () => {
    (0, vitest_1.it)('flags per-ref bounds and the combined budget', () => {
        const issues = (0, media_1.checkMedia)(CFG, {
            image: [ref('i', { width: 1024, height: 1024 })],
            video: [ref('v1', { width: 1024, height: 1024, durationSec: 1 }), ref('v2', { width: 1024, height: 1024, durationSec: 9 })],
            audio: [ref('a1', { durationSec: 8 })],
        });
        (0, vitest_1.expect)(issues.map(i => i.msg)).toEqual([
            'Video 1 must be between 2 and 15 seconds',
            'combined video + audio duration must be at most 15s, got 18s',
        ]);
    });
    (0, vitest_1.it)('unknown durations do not trip the bounds or the budget', () => {
        (0, vitest_1.expect)((0, media_1.checkMedia)(CFG, { video: [ref('v')], audio: [ref('a')] })).toEqual([]);
    });
});
(0, vitest_1.describe)('resolveMediaMeta', () => {
    const resolver = async (r) => (r.id === 'fails' ? Promise.reject(new Error('boom')) : { width: 640, height: 640 });
    (0, vitest_1.it)('fills only refs missing meta, in a NEW input (no mutation)', async () => {
        const input = {
            model: 'demo',
            media: {
                image: [ref('a'), ref('b', { width: 1, height: 1 })],
                start_image: ref('single'), // non-array values stay non-array
            },
            settings: {},
        };
        const out = await (0, media_meta_1.resolveMediaMeta)(input, resolver);
        (0, vitest_1.expect)(out).not.toBe(input);
        (0, vitest_1.expect)(out.media.image[0].meta).toEqual({ width: 640, height: 640 });
        (0, vitest_1.expect)(out.media.image[1].meta).toEqual({ width: 1, height: 1 }); // untouched
        (0, vitest_1.expect)(out.media.start_image.meta).toEqual({ width: 640, height: 640 });
        (0, vitest_1.expect)(input.media.image[0].meta).toBeUndefined(); // original intact
    });
    (0, vitest_1.it)('a failing resolver leaves that ref as-is instead of failing the step', async () => {
        const out = await (0, media_meta_1.resolveMediaMeta)({ media: { image: [ref('fails'), ref('ok')] } }, resolver);
        const [failed, ok] = out.media.image;
        (0, vitest_1.expect)(failed.meta).toBeUndefined();
        (0, vitest_1.expect)(ok.meta).toEqual({ width: 640, height: 640 });
    });
    (0, vitest_1.it)('passes through inputs without media', async () => {
        const input = { model: 'demo', settings: {}, media: undefined };
        (0, vitest_1.expect)(await (0, media_meta_1.resolveMediaMeta)(input, resolver)).toBe(input);
    });
});
(0, vitest_1.describe)('integration: the seedance-2-0 declaration', () => {
    (0, vitest_1.it)('meta violations fail buildWireParams as one aggregated ValidationError', async () => {
        const { buildWireParams } = await Promise.resolve().then(() => __importStar(require('../../spec')));
        const { seedance2_0 } = await Promise.resolve().then(() => __importStar(require('../../jobs/seedance-2-0')));
        const input = {
            model: 'seedance_2_0',
            prompt: { instruction: 'x' },
            media: {
                start_image: [ref('frame', { width: 100, height: 100 })], // below 300px
                audio: [ref('a', { durationSec: 20 })], // above 15s
            },
            settings: { duration: 5, aspectRatio: 'auto' },
        };
        (0, vitest_1.expect)(() => buildWireParams(input, seedance2_0)).toThrowError(/minimum dimension is 300px/);
        (0, vitest_1.expect)(() => buildWireParams(input, seedance2_0)).toThrowError(/between 2 and 15 seconds/);
    });
    (0, vitest_1.it)('meta never reaches the wire — the codec sends only id/type/url', async () => {
        const { buildWireParams } = await Promise.resolve().then(() => __importStar(require('../../spec')));
        const { seedance2_0 } = await Promise.resolve().then(() => __importStar(require('../../jobs/seedance-2-0')));
        const wire = buildWireParams({
            model: 'seedance_2_0',
            prompt: { instruction: 'a cube' },
            media: { start_image: [ref('frame', { width: 1024, height: 1024 })] },
            settings: { duration: 5, aspectRatio: 'auto' },
        }, seedance2_0);
        const items = wire.medias;
        (0, vitest_1.expect)(items[0].data).toEqual({ id: 'frame', type: 'media_input', url: 'https://cdn/frame.png' });
    });
});
(0, vitest_1.describe)('createDomMediaMetaResolver outside a DOM', () => {
    (0, vitest_1.it)('resolves to undefined instead of throwing (safe to wire unconditionally)', async () => {
        const { createDomMediaMetaResolver } = await Promise.resolve().then(() => __importStar(require('../../media/dom-meta-resolver')));
        (0, vitest_1.expect)(await createDomMediaMetaResolver()(ref('x'))).toBeUndefined();
    });
});
(0, vitest_1.describe)('createDomMediaMetaResolver in a DOM', () => {
    /** Stub the structural DOM the resolver probes; `loads[n]` scripts attempt n. */
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
    function imageRef() {
        return { id: 'frame', type: 'image', url: 'blob:frame' };
    }
    (0, vitest_1.it)('a failed measurement resolves undefined (the MediaMetaResolver contract), never rejects', async () => {
        const dom = stubDom([false]);
        try {
            const { createDomMediaMetaResolver } = await Promise.resolve().then(() => __importStar(require('../../media/dom-meta-resolver')));
            (0, vitest_1.expect)(await createDomMediaMetaResolver()(imageRef())).toBeUndefined();
        }
        finally {
            dom.restore();
        }
    });
    (0, vitest_1.it)('failures are not cached — a retry of the same url re-measures', async () => {
        const dom = stubDom([false, true]);
        try {
            const { createDomMediaMetaResolver } = await Promise.resolve().then(() => __importStar(require('../../media/dom-meta-resolver')));
            const resolve = createDomMediaMetaResolver();
            (0, vitest_1.expect)(await resolve(imageRef())).toBeUndefined();
            (0, vitest_1.expect)(await resolve(imageRef())).toEqual({ width: 800, height: 600 });
            (0, vitest_1.expect)(dom.attempts.count).toBe(2);
        }
        finally {
            dom.restore();
        }
    });
    (0, vitest_1.it)('successes ARE cached — one measurement per url', async () => {
        const dom = stubDom([true]);
        try {
            const { createDomMediaMetaResolver } = await Promise.resolve().then(() => __importStar(require('../../media/dom-meta-resolver')));
            const resolve = createDomMediaMetaResolver();
            (0, vitest_1.expect)(await resolve(imageRef())).toEqual({ width: 800, height: 600 });
            (0, vitest_1.expect)(await resolve(imageRef())).toEqual({ width: 800, height: 600 });
            (0, vitest_1.expect)(dom.attempts.count).toBe(1);
        }
        finally {
            dom.restore();
        }
    });
});
//# sourceMappingURL=media-meta.test.js.map