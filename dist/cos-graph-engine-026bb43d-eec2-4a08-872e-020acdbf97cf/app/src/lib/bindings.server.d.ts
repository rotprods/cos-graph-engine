import type { D1Database, DurableObjectNamespace, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
type AppEnv = {
    DB?: D1Database;
    STORAGE?: R2Bucket;
    KV?: KVNamespace;
    CONTAINER?: DurableObjectNamespace;
    HF_ENV?: string;
    APP_SLUG?: string;
};
export declare function bindings(): AppEnv;
export {};
//# sourceMappingURL=bindings.server.d.ts.map