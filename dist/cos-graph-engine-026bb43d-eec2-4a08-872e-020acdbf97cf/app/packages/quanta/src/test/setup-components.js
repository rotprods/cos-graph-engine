"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
require("@testing-library/jest-dom/vitest");
// @testing-library/react v16 auto-registers cleanup() after each test when it
// detects a global afterEach. Vitest does not expose afterEach as a global
// (globals: false), so we register it explicitly here.
(0, vitest_1.afterEach)(react_1.cleanup);
// Radix relies on a handful of DOM APIs that happy-dom does not implement.
// Polyfill them so menu open/close and focus management work under test.
const proto = Element.prototype;
proto.hasPointerCapture ??= () => false;
proto.setPointerCapture ??= () => { };
proto.releasePointerCapture ??= () => { };
proto.scrollIntoView ??= () => { };
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    };
}
//# sourceMappingURL=setup-components.js.map