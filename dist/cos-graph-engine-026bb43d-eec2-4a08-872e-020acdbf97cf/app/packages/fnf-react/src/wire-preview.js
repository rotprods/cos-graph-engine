"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWirePreview = getWirePreview;
exports.useFnfWirePreview = useFnfWirePreview;
const fnf_1 = require("@higgsfield/fnf");
const react_1 = require("react");
const provider_1 = require("./provider");
function getWirePreview(input, jobs) {
    try {
        const entry = (0, fnf_1.buildRegistry)(jobs).get(input.model);
        if (!entry)
            throw new fnf_1.ApiJobError('unknown_model', `Unknown model: ${input.model}`);
        return {
            ok: true,
            jobSetType: entry.jobSetType,
            outputType: entry.outputType,
            params: (0, fnf_1.buildWireParams)(input, entry),
        };
    }
    catch (err) {
        if (err instanceof fnf_1.ApiJobError)
            return { ok: false, error: err.toJSON() };
        return { ok: false, error: { code: 'unexpected', message: err instanceof Error ? err.message : String(err) } };
    }
}
function useFnfWirePreview(input) {
    const jobs = (0, provider_1.useFnfJobs)();
    return (0, react_1.useMemo)(() => getWirePreview(input, jobs), [input, jobs]);
}
//# sourceMappingURL=wire-preview.js.map