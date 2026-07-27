"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const vite_1 = require("vite");
const vite_plugin_dts_1 = __importDefault(require("vite-plugin-dts"));
// Build entries are derived from the public `exports` map so a new subpath
// added to package.json is picked up here (and by scripts/make-publish-package.mjs)
// without touching this config.
const pkg = JSON.parse((0, node_fs_1.readFileSync)(new URL('./package.json', import.meta.url), 'utf8'));
const entry = Object.fromEntries(Object.entries(pkg.exports)
    .filter(([, target]) => target.endsWith('.ts'))
    .map(([subpath, target]) => [subpath === '.' ? 'index' : subpath.slice(2), target]));
exports.default = (0, vite_1.defineConfig)({
    plugins: [
        (0, vite_plugin_dts_1.default)({
            entryRoot: 'src',
            exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.test-d.ts'],
        }),
    ],
    build: {
        target: 'es2021',
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        // No source maps: they would embed the full original TypeScript source
        // (sourcesContent) in the published tarball.
        sourcemap: false,
        lib: {
            entry,
            formats: ['es'],
        },
        rollupOptions: {
            // zod is intentionally bundled — the published package has no runtime
            // dependencies, so external consumers install nothing else.
            output: {
                entryFileNames: '[name].js',
                // Shared modules (error classes, error-code registry, media side-effect
                // registrations) must land in common chunks so every entrypoint sees a
                // single copy — duplicating them would break instanceof and rehydration.
                chunkFileNames: 'chunks/[name]-[hash].js',
            },
        },
    },
});
//# sourceMappingURL=vite.config.js.map