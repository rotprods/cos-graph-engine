import type { ComponentProps, ReactNode } from 'react';
import { Toast as Primitive } from '@base-ui/react/toast';
/**
 * Sonner — an opinionated toast system on Base UI Toast, skinned with quanta
 * tokens. The imperative `toast()` API (`toast.success(...)`, `toast.promise(...)`)
 * mirrors the `sonner` library: it drives a module-level toast manager, so toasts
 * can be fired from anywhere (event handlers, effects, non-React code). Mount one
 * `<Toaster />` near the app root; Base UI owns timing, stacking, swipe-to-dismiss,
 * focus and a11y — quanta only paints.
 *
 *   import { Toaster, toast } from '@higgsfield/quanta/sonner'
 *   <Toaster position="bottom-right" />
 *   toast.success('Saved', { description: 'Your changes are live.' })
 */
export type SonnerVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';
export type SonnerPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
/** The simple built-in action button config (sonner-shaped). */
export interface SonnerActionConfig {
    label: string;
    onClick?: () => void;
}
export declare const sonnerManager: any;
interface ToastOptions {
    description?: ReactNode;
    /** Auto-dismiss delay in ms (0 keeps it until dismissed). */
    duration?: number;
    icon?: ReactNode;
    /**
     * A trailing action. Either the simple `{ label, onClick }` button, or any
     * `ReactNode` (e.g. a quanta `Button`, a link, or several buttons).
     */
    action?: ReactNode | SonnerActionConfig;
    id?: string;
}
/** Imperative toast API (sonner-shaped). */
export declare const toast: ((title: ReactNode, options?: ToastOptions) => string) & {
    success: (title: ReactNode, options?: ToastOptions) => string;
    error: (title: ReactNode, options?: ToastOptions) => string;
    warning: (title: ReactNode, options?: ToastOptions) => string;
    info: (title: ReactNode, options?: ToastOptions) => string;
    loading: (title: ReactNode, options?: ToastOptions) => string;
    message: (title: ReactNode, options?: ToastOptions) => string;
    dismiss: (id?: string) => any;
    /** Pending → resolved/rejected, sonner-style. */
    promise: <T>(promise: Promise<T>, msgs: {
        loading: ReactNode;
        success: ReactNode | ((v: T) => ReactNode);
        error: ReactNode | ((e: unknown) => ReactNode);
    }) => any;
};
export interface ToasterProps extends Omit<ComponentProps<typeof Primitive.Viewport>, 'children' | 'className'> {
    position?: SonnerPosition;
    /** Max simultaneously-visible toasts; older ones collapse behind / queue. Default 3. */
    limit?: number;
    /** Default auto-dismiss in ms. Default 5000. */
    duration?: number;
    /**
     * Expand the stack by default. When false (default) toasts collapse into a
     * peeking pile and expand on hover / focus (Sonner behaviour).
     */
    expand?: boolean;
    /** Gap between toasts when expanded, in px. Default 14. */
    gap?: number;
    className?: string;
}
/**
 * Mount once near the app root. Toasts collapse into a glassy stack and expand
 * on hover/focus (or always, with `expand`). `limit` caps the visible pile;
 * Base UI owns the stack offsets, swipe-to-dismiss, timing, focus and a11y.
 */
export declare function Toaster({ position, limit, duration, expand, gap, className, style, ...props }: ToasterProps): any;
export {};
//# sourceMappingURL=sonner.d.ts.map