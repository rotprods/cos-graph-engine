import type { ConfirmSubmit, FnfAdapter } from '../backend';
import type { FnfObservabilityOptions } from '../observability';
import type { Transport } from '../transport';
export type { FnfAdapter } from '../backend';
type MaybePromise<T> = T | Promise<T>;
type RequiredHeaderSource = string | (() => MaybePromise<string>);
type OptionalHeaderSource = string | (() => MaybePromise<string | null | undefined>);
export interface WorkflowPlatformAdapterOptions {
    /** Workflow Platform origin. Required unless `transport` is injected. */
    baseUrl?: string;
    /** Optional user-scoped token source; sent as `Authorization: Bearer <token>`. */
    getToken?: () => Promise<string | null>;
    /** Optional acting user id; sent as `hf-user-id`. */
    userId?: RequiredHeaderSource;
    /** Optional active workspace id; sent as `hf-workspace-id`. */
    workspaceId?: OptionalHeaderSource;
    /** Optional generated app id; sent as `hf-app-id`. */
    appId?: OptionalHeaderSource;
    fetch?: typeof globalThis.fetch;
    /** Inject a transport directly (tests / custom). Overrides baseUrl/fetch/header options. */
    transport?: Transport;
    observability?: FnfObservabilityOptions;
    /**
     * Host confirmation gate run by `submit` before any create request. Its
     * resolved token is sent as `confirmation_token` on the submit body. See
     * `ConfirmSubmit`.
     */
    confirm?: ConfirmSubmit;
}
/**
 * Workflow Platform adapter.
 *
 * The SDK keeps doing typed validation and param serialization, then sends
 * static WFP routes. WFP owns final fnf.internal route selection and
 * product-specific request-body quirks. This adapter intentionally stays under:
 * `/user`, `/workspaces/*`, and `/jobs/*`.
 */
export declare function createWorkflowPlatformAdapter(options?: WorkflowPlatformAdapterOptions): FnfAdapter;
//# sourceMappingURL=workflow-platform-adapter.d.ts.map