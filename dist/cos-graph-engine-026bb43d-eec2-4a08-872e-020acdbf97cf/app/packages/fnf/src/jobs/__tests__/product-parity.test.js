"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errors_1 = require("../../errors");
const spec_1 = require("../../spec");
const dimensions_1 = require("../dimensions");
const kling_1 = require("../kling");
const nano_banana_2_1 = require("../nano-banana-2");
const seedance_2_0_1 = require("../seedance-2-0");
const text2image_soul_1 = require("../text2image-soul");
function ref(id, meta) {
    return { id, type: 'media_input', url: `https://cdn/${id}.png`, ...(meta ? { meta } : {}) };
}
function issuesOf(fn) {
    try {
        fn();
        return [];
    }
    catch (err) {
        const issues = err.data?.issues ?? [];
        return issues.map(i => i.msg);
    }
}
// ── restore: lossy finalize hooks round-trip (the get-then-resubmit contract) ──
(0, vitest_1.describe)('seedance restore round-trip', () => {
    (0, vitest_1.it)('a fast generation resubmits as fast (mode restored from wire model)', () => {
        const input = {
            model: 'seedance_2_0',
            prompt: { instruction: 'a cube' },
            settings: { duration: 8, aspectRatio: '16:9', mode: 'fast' },
        };
        const wire = (0, spec_1.buildWireParams)(input, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(wire.model).toBe('seedance_2_0_fast');
        (0, vitest_1.expect)(wire.resolution).toBe('720p'); // fast product default
        const gen = (0, spec_1.parseGeneration)({ id: 'j1', status: 'completed', result_url: 'https://x/v.mp4', params: wire }, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(gen.input.settings.mode).toBe('fast');
        const rewire = (0, spec_1.buildWireParams)(gen.input, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(rewire.model).toBe('seedance_2_0_fast'); // NOT the 'std' schema default
        (0, vitest_1.expect)(rewire.width).toBe(wire.width);
        (0, vitest_1.expect)(rewire.height).toBe(wire.height);
    });
    (0, vitest_1.it)('a frame-led auto generation resubmits wire-identically and passes validate', () => {
        const input = {
            model: 'seedance_2_0',
            prompt: { instruction: 'animate' },
            media: { start_image: [ref('f', { width: 720, height: 1280 })] },
            settings: { duration: 5, aspectRatio: 'auto' },
        };
        const wire = (0, spec_1.buildWireParams)(input, seedance_2_0_1.seedance2_0);
        // product behavior: auto + measured portrait frame → concrete 9:16 + table dims
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('9:16');
        (0, vitest_1.expect)(wire.resolution).toBe('1080p'); // std product default
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([1080, 1920]);
        const gen = (0, spec_1.parseGeneration)({ id: 'j2', status: 'completed', result_url: 'https://x/v.mp4', params: wire }, seedance_2_0_1.seedance2_0);
        // frames lock the INPUT ratio to 'auto' — restore maps the resolved
        // concrete ratio back so the parsed input passes the same validate
        (0, vitest_1.expect)(gen.input.settings.aspectRatio).toBe('auto');
        const rewire = (0, spec_1.buildWireParams)(gen.input, seedance_2_0_1.seedance2_0); // must not throw the ratio lock
        // 'auto' re-resolves from the round-tripped dims (the parsed refs have no
        // meta), so the resubmitted wire is product-shaped and identical
        (0, vitest_1.expect)(rewire.aspect_ratio).toBe('9:16');
        (0, vitest_1.expect)([rewire.width, rewire.height]).toEqual([1080, 1920]);
    });
    (0, vitest_1.it)('changing resolution on a parsed input re-derives dims instead of resubmitting stale ones', () => {
        const wire = (0, spec_1.buildWireParams)({
            model: 'seedance_2_0',
            prompt: { instruction: 'animate' },
            media: { start_image: [ref('f', { width: 720, height: 1280 })] },
            settings: { duration: 5, aspectRatio: 'auto' },
        }, seedance_2_0_1.seedance2_0);
        const gen = (0, spec_1.parseGeneration)({ id: 'j3', status: 'completed', result_url: 'https://x/v.mp4', params: wire }, seedance_2_0_1.seedance2_0);
        const rewire = (0, spec_1.buildWireParams)({
            ...gen.input,
            settings: { ...gen.input.settings, resolution: '480p' },
        }, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(rewire.resolution).toBe('480p');
        (0, vitest_1.expect)([rewire.width, rewire.height]).toEqual([480, 854]); // fresh table lookup, not 1080×1920
    });
});
(0, vitest_1.describe)('kling restore round-trip', () => {
    const portrait = {
        model: 'kling',
        prompt: { instruction: 'pan up' },
        media: { input_image: ref('start', { width: 720, height: 1280 }) },
        settings: { duration: 5, aspectRatio: '9:16' },
    };
    (0, vitest_1.it)('wire dims come from the start image; the backend-enum ratio rides along', () => {
        const wire = (0, spec_1.buildWireParams)(portrait, kling_1.klingVideo);
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([720, 1280]);
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('9:16'); // in the backend enum (16:9|9:16|1:1) → kept
    });
    (0, vitest_1.it)('off-enum ratios are dropped from the wire (the backend accepts only 16:9|9:16|1:1)', () => {
        const wire = (0, spec_1.buildWireParams)({ ...portrait, settings: { duration: 5, aspectRatio: '4:3' } }, kling_1.klingVideo);
        (0, vitest_1.expect)(wire).not.toHaveProperty('aspect_ratio');
    });
    (0, vitest_1.it)('a 9:16 generation resubmits as 9:16 (no silent 16:9 flip)', () => {
        const wire = (0, spec_1.buildWireParams)(portrait, kling_1.klingVideo);
        const gen = (0, spec_1.parseGeneration)({ id: 'k1', status: 'completed', result_url: 'https://x/v.mp4', params: wire }, kling_1.klingVideo);
        (0, vitest_1.expect)(gen.input.settings.aspectRatio).toBe('9:16'); // restored via simplifyRatio
        const rewire = (0, spec_1.buildWireParams)(gen.input, kling_1.klingVideo);
        (0, vitest_1.expect)([rewire.width, rewire.height]).toEqual([720, 1280]);
        (0, vitest_1.expect)(rewire.model).toBe(wire.model);
    });
});
// ── kling product rules ──
(0, vitest_1.describe)('kling product parity', () => {
    const base = {
        model: 'kling',
        media: { input_image: ref('start') },
    };
    (0, vitest_1.it)('enhance_prompt defaults to true and respects the default-preset sentinel', () => {
        // sentinel motion_id (the default) → the caller's choice, defaulting true
        const wire = (0, spec_1.buildWireParams)({ ...base, settings: { duration: 5 } }, kling_1.klingVideo);
        (0, vitest_1.expect)(wire.motion_id).toBe(kling_1.KLING_DEFAULT_MOTION_ID);
        (0, vitest_1.expect)(wire.enhance_prompt).toBe(true);
        const declined = (0, spec_1.buildWireParams)({ ...base, prompt: { enhance: false }, settings: { duration: 5 } }, kling_1.klingVideo);
        (0, vitest_1.expect)(declined.enhance_prompt).toBe(false); // sentinel = "no preset" → user choice respected
        const preset = (0, spec_1.buildWireParams)({ ...base, prompt: { enhance: false }, settings: { duration: 5, motionId: 'real-preset-uuid' } }, kling_1.klingVideo);
        (0, vitest_1.expect)(preset.enhance_prompt).toBe(true); // a real preset forces it on
    });
    (0, vitest_1.it)('always wires a prompt string and never the dead seed/cfg_scale knobs', () => {
        const wire = (0, spec_1.buildWireParams)({ ...base, settings: { duration: 5 } }, kling_1.klingVideo);
        (0, vitest_1.expect)(wire.prompt).toBe(''); // the product always sends a string ('' when promptless)
        (0, vitest_1.expect)(wire).not.toHaveProperty('seed'); // backend KlingParamsSchema drops it silently
        (0, vitest_1.expect)(wire).not.toHaveProperty('cfg_scale');
    });
    (0, vitest_1.it)('text-only kling works only at v2-5-turbo + 1080p (the one combination the backend allows)', () => {
        const wire = (0, spec_1.buildWireParams)({ model: 'kling', prompt: { instruction: 'a storm rolls in' }, settings: { duration: 5, resolution: '1080p', aspectRatio: '9:16' } }, kling_1.klingVideo);
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([720, 1280]); // box-derived dims
        (0, vitest_1.expect)(wire.mode).toBe('pro');
        // default resolution (720p → std) requires a start frame server-side
        (0, vitest_1.expect)(issuesOf(() => (0, spec_1.buildWireParams)({ model: 'kling', prompt: { instruction: 'a storm rolls in' }, settings: { duration: 5 } }, kling_1.klingVideo))).toContain('input image is required for this model and mode');
    });
    (0, vitest_1.it)('legacy params with motion_id null coalesce to the sentinel and respect a stored enhance_prompt: false', () => {
        // shape stored by the previous SDK (motionId defaulted to null)
        const legacy = {
            model: 'kling-v2-5-turbo',
            prompt: 'pan',
            input_image: { id: 'start', type: 'media_input', url: 'https://cdn/start.png' },
            enhance_prompt: false,
            motion_id: null,
            cfg_scale: 0.5,
            resolution: '720p',
            duration: 5,
            seed: 7,
            use_unlim: false,
            width: 720,
            height: 1280,
            mode: 'std',
        };
        const gen = (0, spec_1.parseGeneration)({ id: 'k-old', status: 'completed', result_url: 'https://x/v.mp4', params: legacy }, kling_1.klingVideo);
        const rewire = (0, spec_1.buildWireParams)(gen.input, kling_1.klingVideo);
        (0, vitest_1.expect)(rewire.motion_id).toBe(kling_1.KLING_DEFAULT_MOTION_ID); // product wire never carries null
        (0, vitest_1.expect)(rewire.enhance_prompt).toBe(false); // NOT force-flipped to true
    });
    (0, vitest_1.it)('rejects out-of-set durations with a typed issue (VideoKlingDuration is 5 | 10)', () => {
        (0, vitest_1.expect)(issuesOf(() => (0, spec_1.buildWireParams)({ ...base, settings: { duration: 7 } }, kling_1.klingVideo))).toContain('duration must be one of: 5, 10');
    });
});
// ── auto-ratio resolution from measured media (product parity) ──
(0, vitest_1.describe)('auto aspect ratio resolves from the first image like the product', () => {
    (0, vitest_1.it)('nano: auto + landscape image meta → 16:9 with table dims (not 3:4)', () => {
        const wire = (0, spec_1.buildWireParams)({
            model: 'nano_banana_2',
            prompt: { instruction: 'restyle this' },
            media: { image: [ref('i', { width: 1920, height: 1080 })] },
            settings: { aspectRatio: 'auto' },
        }, nano_banana_2_1.nanoBanana2);
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('16:9');
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([1376, 768]);
    });
    (0, vitest_1.it)('nano: auto without local size knowledge falls back to 3:4', () => {
        const wire = (0, spec_1.buildWireParams)({ model: 'nano_banana_2', prompt: { instruction: 'a cat' }, settings: { aspectRatio: 'auto' } }, nano_banana_2_1.nanoBanana2);
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('3:4');
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([896, 1200]);
    });
    (0, vitest_1.it)('seedance: auto without meta keeps auto on the wire with the 16:9 dims', () => {
        const wire = (0, spec_1.buildWireParams)({
            model: 'seedance_2_0',
            prompt: { instruction: 'x' },
            media: { image: [ref('i')] },
            settings: { duration: 5, aspectRatio: 'auto' },
        }, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('auto');
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([1920, 1080]);
    });
});
// ── validation gaps closed (typed issues, not TypeErrors / backend 422s) ──
(0, vitest_1.describe)('seedance validate', () => {
    const withPrompt = (settings) => () => (0, spec_1.buildWireParams)({ model: 'seedance_2_0', prompt: { instruction: 'x' }, settings: settings }, seedance_2_0_1.seedance2_0);
    (0, vitest_1.it)('enforces duration 4–15 (built.ts hard reject)', () => {
        (0, vitest_1.expect)(issuesOf(withPrompt({ duration: 30, aspectRatio: 'auto' }))).toContain('duration must be between 4 and 15');
    });
    (0, vitest_1.it)('rejects out-of-enum ratios with a typed issue instead of a TypeError', () => {
        (0, vitest_1.expect)(issuesOf(withPrompt({ duration: 8, aspectRatio: '2:1' }))[0]).toMatch(/aspectRatio must be one of/);
    });
    (0, vitest_1.it)('rejects fast + 1080p (the product fast config never offers it)', () => {
        (0, vitest_1.expect)(issuesOf(withPrompt({ duration: 8, aspectRatio: 'auto', mode: 'fast', resolution: '1080p' })))
            .toContain('resolution \'1080p\' is not available in fast mode');
    });
    (0, vitest_1.it)('defaults resolution per mode: std → 1080p, fast → 720p', () => {
        const std = (0, spec_1.buildWireParams)({ model: 'seedance_2_0', prompt: { instruction: 'x' }, settings: { duration: 8, aspectRatio: '16:9' } }, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(std.resolution).toBe('1080p');
        (0, vitest_1.expect)([std.width, std.height]).toEqual([1920, 1080]);
        const fast = (0, spec_1.buildWireParams)({ model: 'seedance_2_0', prompt: { instruction: 'x' }, settings: { duration: 8, aspectRatio: '16:9', mode: 'fast' } }, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(fast.resolution).toBe('720p');
        (0, vitest_1.expect)([fast.width, fast.height]).toEqual([1280, 720]);
    });
});
(0, vitest_1.describe)('nano validate', () => {
    (0, vitest_1.it)('caps input images at 14 (NANO_BANANA_2_IMAGE_UPLOAD_LIMIT)', () => {
        const refs = Array.from({ length: 15 }, (_, i) => ref(`r${i}`));
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({ model: 'nano_banana_2', prompt: { instruction: 'x' }, media: { image: refs }, settings: { aspectRatio: '1:1' } }, nano_banana_2_1.nanoBanana2)).toThrow(/image.*at most 14.*got 15/);
    });
    (0, vitest_1.it)('flags images under the 128px product minimum when meta is known', () => {
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({ model: 'nano_banana_2', prompt: { instruction: 'x' }, media: { image: [ref('tiny', { width: 64, height: 64 })] }, settings: { aspectRatio: '1:1' } }, nano_banana_2_1.nanoBanana2)).toThrow(/minimum dimension is 128px/);
    });
    (0, vitest_1.it)('rejects on RAW prompt length >= 15000 (validatePrompt parity)', () => {
        const padded = `${'x'.repeat(14_000)}${' '.repeat(1_000)}`; // trimmed 14k, raw 15k
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({ model: 'nano_banana_2', prompt: { instruction: padded }, settings: { aspectRatio: '1:1' } }, nano_banana_2_1.nanoBanana2)).toThrow(/too long/);
    });
});
// ── soul product parity ──
(0, vitest_1.describe)('soul product parity', () => {
    const minimal = { model: 'text2image_soul', prompt: { instruction: 'portrait' }, settings: {} };
    (0, vitest_1.it)('default submit matches the /ai/image strategy: style, steps 50, sampler fields, portrait table dims', () => {
        const wire = (0, spec_1.buildWireParams)(minimal, text2image_soul_1.textToImageSoul);
        (0, vitest_1.expect)(wire.style_id).toBe(text2image_soul_1.DEFAULT_SOUL_STYLE_ID); // never null/null
        (0, vitest_1.expect)(wire.steps).toBe(50);
        (0, vitest_1.expect)(wire.sample_shift).toBe(4); // 1080p default
        (0, vitest_1.expect)(wire.sample_guide_scale).toBe(4);
        (0, vitest_1.expect)(wire.negative_prompt).toBe('');
        (0, vitest_1.expect)(wire.enhance_prompt).toBe(true);
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('3:4'); // the product soul form defaults to PORTRAIT
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([1536, 2048]); // SOUL_RESOLUTION_MAP 1080p 3:4
        (0, vitest_1.expect)(wire.seed).toBeGreaterThanOrEqual(1);
        (0, vitest_1.expect)(wire.seed).toBeLessThanOrEqual(1_000_000);
    });
    (0, vitest_1.it)('snaps an off-table ratio to the closest table key instead of the portrait fallback', () => {
        const wire = (0, spec_1.buildWireParams)({ ...minimal, settings: { aspectRatio: '1920:1080' } }, text2image_soul_1.textToImageSoul);
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('16:9'); // a landscape request stays landscape
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([2048, 1152]);
    });
    (0, vitest_1.it)('720p quality switches the table row and sample_shift', () => {
        const wire = (0, spec_1.buildWireParams)({ ...minimal, settings: { quality: '720p', aspectRatio: '16:9' } }, text2image_soul_1.textToImageSoul);
        (0, vitest_1.expect)(wire.sample_shift).toBe(3);
        (0, vitest_1.expect)([wire.width, wire.height]).toEqual([1696, 960]);
    });
    (0, vitest_1.it)('explicit styleId: null fails locally with a typed issue (dev backend 422 parity)', () => {
        (0, vitest_1.expect)(issuesOf(() => (0, spec_1.buildWireParams)({ ...minimal, settings: { styleId: null } }, text2image_soul_1.textToImageSoul)))
            .toContain('styleId is required (or send fashion_factory_id via extra)');
    });
    (0, vitest_1.it)('an image reference forces enhance_prompt off; a non-default style forces it on', () => {
        const referenced = (0, spec_1.buildWireParams)({ ...minimal, media: { image_reference: ref('r') } }, text2image_soul_1.textToImageSoul);
        (0, vitest_1.expect)(referenced.enhance_prompt).toBe(false);
        const styled = (0, spec_1.buildWireParams)({ ...minimal, prompt: { instruction: 'x', enhance: false }, settings: { styleId: 'custom-style' } }, text2image_soul_1.textToImageSoul);
        (0, vitest_1.expect)(styled.enhance_prompt).toBe(true);
    });
});
(0, vitest_1.describe)('lookupSize', () => {
    (0, vitest_1.it)('throws the typed ValidationError on unknown keys, not a TypeError', () => {
        const map = { '1k': { '1:1': [10, 10] } };
        (0, vitest_1.expect)(() => (0, dimensions_1.lookupSize)(map, '1k', '7:3')).toThrowError(errors_1.ValidationError);
        (0, vitest_1.expect)(() => (0, dimensions_1.lookupSize)(map, '1k', '7:3')).toThrow(/not supported/);
    });
});
//# sourceMappingURL=product-parity.test.js.map