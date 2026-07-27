"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportHiggsfieldError = reportHiggsfieldError;
function reportHiggsfieldError(error, context = {}) {
    if (typeof window === "undefined")
        return;
    window.__higgsfieldEvents?.captureException?.(error, {
        source: "react_error_boundary",
        route: window.location.pathname,
        ...context,
    }, {
        mechanism: "react_error_boundary",
        handled: false,
        severity: "error",
    });
}
//# sourceMappingURL=higgsfield-error-reporting.js.map