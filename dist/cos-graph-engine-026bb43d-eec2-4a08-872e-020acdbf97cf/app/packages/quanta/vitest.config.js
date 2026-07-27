"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        projects: [
            {
                test: {
                    name: 'codegen',
                    environment: 'node',
                    include: ['scripts/**/*.test.ts'],
                },
            },
            {
                test: {
                    name: 'runtime',
                    environment: 'happy-dom',
                    include: ['src/runtime/**/*.test.ts'],
                },
            },
            {
                test: {
                    name: 'components',
                    environment: 'happy-dom',
                    include: ['src/components/**/*.test.tsx'],
                    setupFiles: ['./src/test/setup-components.ts'],
                    alias: {
                        'use-sync-external-store/shim/with-selector': 'use-sync-external-store/shim/with-selector.js',
                        'use-sync-external-store/shim': 'use-sync-external-store/shim/index.js',
                        'use-sync-external-store/with-selector': 'use-sync-external-store/with-selector.js',
                    },
                    server: {
                        deps: {
                            inline: [/use-sync-external-store/, /@base-ui\/react/],
                        },
                    },
                },
            },
        ],
    },
});
//# sourceMappingURL=vitest.config.js.map