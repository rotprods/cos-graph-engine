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
exports.z = void 0;
exports.getNormalize = getNormalize;
exports.getWireName = getWireName;
exports.wire = wire;
exports.aspectRatio = aspectRatio;
exports.duration = duration;
const base = __importStar(require("zod/mini"));
/**
 * Side table from a normalized schema object to its descriptor. Keyed on the
 * schema instance via a WeakMap so we never mutate the zod object (no extra
 * own-property, no `as unknown as`) and don't depend on zod tolerating stray
 * properties across versions.
 */
const NORMALIZERS = new WeakMap();
/**
 * Look a schema up in a side table, walking zod wrapper chains
 * (`z.optional(...)` / `z._default(...)` expose the tagged inner schema via
 * `_zod.def.innerType`) so wrapping a tagged schema doesn't silently drop
 * its normalizer / wire name.
 */
function lookup(schema, table) {
    let current = typeof schema === 'object' && schema !== null ? schema : undefined;
    for (let depth = 0; current && depth < 10; depth++) {
        const hit = table.get(current);
        if (hit !== undefined)
            return hit;
        const inner = current._zod?.def?.innerType;
        current = typeof inner === 'object' && inner !== null ? inner : undefined;
    }
    return undefined;
}
function getNormalize(schema) {
    return lookup(schema, NORMALIZERS);
}
/**
 * Side table mapping a settings schema to its wire field name. By default a
 * job's settings key IS the wire key; `z.wire('aspect_ratio', schema)` decouples
 * them so the typed API stays camelCase while the wire emits the backend's
 * canonical name. Same WeakMap pattern as the normalizers — no schema mutation.
 */
const WIRE_NAMES = new WeakMap();
function getWireName(schema) {
    return lookup(schema, WIRE_NAMES);
}
/** Tag a settings schema with an explicit wire field name (typed identity). */
function wire(name, schema) {
    WIRE_NAMES.set(schema, name);
    return schema;
}
function aspectRatio(options) {
    // Runtime accepts any ratio string; normalization maps it to the closest
    // allowed option. (An enum would reject inputs like "1920:1081" before we can
    // normalize.) The static type, though, is the literal union `O[number]` so
    // callers get autocomplete on the canonical ratios.
    const schema = base.string();
    NORMALIZERS.set(schema, { kind: 'aspectRatio', options });
    return schema;
}
function duration(opts) {
    // Same shape as aspectRatio: permissive `number` at runtime, literal union of
    // `values` at the type level (or plain `number` for a min/max range).
    const schema = base.number();
    NORMALIZERS.set(schema, { kind: 'duration', ...opts });
    return schema;
}
function _default(innerType, defaultValue) {
    return base._default(innerType, defaultValue);
}
exports.z = { ...base, _default, aspectRatio, duration, wire };
//# sourceMappingURL=z.js.map