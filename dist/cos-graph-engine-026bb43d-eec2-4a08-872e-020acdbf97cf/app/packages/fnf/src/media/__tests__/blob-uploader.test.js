"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errors_1 = require("../../errors");
const blob_uploader_1 = require("../blob-uploader");
const errors_2 = require("../errors");
function uploader(fetch, retries = 2) {
    return (0, blob_uploader_1.createFetchUploader)({ fetch, retries });
}
const PUT = { uploadUrl: 'https://s3/put/m1', bytes: new Uint8Array([1]), contentType: 'image/png' };
(0, vitest_1.describe)('createFetchUploader.transfer', () => {
    (0, vitest_1.it)('retries 5xx then succeeds', async () => {
        let calls = 0;
        const up = uploader(async () => new Response('', { status: ++calls < 2 ? 503 : 200 }));
        await up.transfer(PUT);
        (0, vitest_1.expect)(calls).toBe(2);
    });
    (0, vitest_1.it)('bails on 4xx with the status (no retry)', async () => {
        let calls = 0;
        const up = uploader(async () => {
            calls++;
            return new Response('denied', { status: 403 });
        });
        await (0, vitest_1.expect)(up.transfer(PUT)).rejects.toMatchObject({ code: 'upload_failed', status: 403 });
        (0, vitest_1.expect)(calls).toBe(1);
    });
    (0, vitest_1.it)('an abort mid-PUT throws JobAbortedError without burning the retry budget', async () => {
        const controller = new AbortController();
        let calls = 0;
        const up = uploader(async () => {
            calls++;
            controller.abort(); // abort lands while the PUT is in flight
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            throw err;
        });
        await (0, vitest_1.expect)(up.transfer({ ...PUT, signal: controller.signal })).rejects.toBeInstanceOf(errors_1.JobAbortedError);
        (0, vitest_1.expect)(calls).toBe(1); // not retried with the aborted signal
    });
    (0, vitest_1.it)('a pre-aborted signal throws before any request', async () => {
        const controller = new AbortController();
        controller.abort();
        let calls = 0;
        const up = uploader(async () => {
            calls++;
            return new Response('', { status: 200 });
        });
        await (0, vitest_1.expect)(up.transfer({ ...PUT, signal: controller.signal })).rejects.toBeInstanceOf(errors_1.JobAbortedError);
        (0, vitest_1.expect)(calls).toBe(0);
    });
    (0, vitest_1.it)('exhausted network retries surface the last cause in the message', async () => {
        const up = uploader(async () => {
            throw new TypeError('Failed to fetch');
        }, 1);
        await (0, vitest_1.expect)(up.transfer(PUT)).rejects.toThrow(/after 2 attempts: Failed to fetch/);
    });
});
(0, vitest_1.describe)('createFetchUploader.fetchBytes', () => {
    (0, vitest_1.it)('returns bytes + content type', async () => {
        const up = uploader(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } }));
        const out = await up.fetchBytes('https://x/a.png');
        (0, vitest_1.expect)(out.contentType).toBe('image/png');
        (0, vitest_1.expect)(out.bytes.length).toBe(3);
    });
    (0, vitest_1.it)('rejects early via content-length and late via byteLength when over maxBytes', async () => {
        const declared = uploader(async () => new Response('', { status: 200, headers: { 'content-length': '10' } }));
        await (0, vitest_1.expect)(declared.fetchBytes('https://x/a', { maxBytes: 5 })).rejects.toBeInstanceOf(errors_2.UrlIngestError);
        const undeclared = uploader(async () => new Response(new Uint8Array(10), { status: 200 }));
        await (0, vitest_1.expect)(undeclared.fetchBytes('https://x/a', { maxBytes: 5 })).rejects.toBeInstanceOf(errors_2.UrlIngestError);
    });
    (0, vitest_1.it)('an abort during the download throws JobAbortedError, not UrlIngestError', async () => {
        const controller = new AbortController();
        const up = uploader(async () => {
            controller.abort();
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        });
        await (0, vitest_1.expect)(up.fetchBytes('https://x/a', { signal: controller.signal })).rejects.toBeInstanceOf(errors_1.JobAbortedError);
    });
    (0, vitest_1.it)('a non-OK response throws UploadTransferError-free UrlIngestError with the status', async () => {
        const up = uploader(async () => new Response('', { status: 404 }));
        await (0, vitest_1.expect)(up.fetchBytes('https://x/a')).rejects.toThrow(/404/);
        await (0, vitest_1.expect)(up.fetchBytes('https://x/a')).rejects.toBeInstanceOf(errors_2.UrlIngestError);
        (0, vitest_1.expect)(errors_2.UploadTransferError.is(await up.fetchBytes('https://x/a').catch(e => e))).toBe(false);
    });
});
//# sourceMappingURL=blob-uploader.test.js.map