"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredData = StructuredData;
/**
 * SSR-safe JSON-LD structured data component.
 * Place at the top of page JSX, before visible content.
 * The `json` prop must be a pre-stringified JSON string (module-level const).
 */
function StructuredData({ json }) {
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }}/>;
}
//# sourceMappingURL=StructuredData.js.map