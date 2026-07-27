"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.field = field;
exports.group = group;
function field(wire) {
    return { wire };
}
function group(map) {
    const entries = Object.entries(map);
    const wireKeys = entries.map(([, def]) => def.wire);
    return {
        wireKeys,
        serialize(value) {
            const out = {};
            for (const [key, def] of entries) {
                const v = value?.[key];
                if (v !== undefined)
                    out[def.wire] = v;
            }
            return out;
        },
        parse(wire) {
            const out = {};
            for (const [key, def] of entries) {
                if (wire[def.wire] !== undefined)
                    out[key] = wire[def.wire];
            }
            return out;
        },
    };
}
//# sourceMappingURL=group.js.map