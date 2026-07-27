type HiggsfieldErrorOptions = {
    mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
    handled?: boolean;
    severity?: "error" | "warning" | "info";
};
type HiggsfieldEvents = {
    captureException?: (error: unknown, context?: Record<string, unknown>, options?: HiggsfieldErrorOptions) => void;
};
declare global {
    interface Window {
        __higgsfieldEvents?: HiggsfieldEvents;
    }
}
export declare function reportHiggsfieldError(error: unknown, context?: Record<string, unknown>): void;
export {};
//# sourceMappingURL=higgsfield-error-reporting.d.ts.map