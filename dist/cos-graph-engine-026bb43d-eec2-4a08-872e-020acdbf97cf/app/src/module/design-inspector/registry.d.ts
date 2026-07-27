import type { Ref, RefCallback } from "react";
export interface HiggsfieldDesignSourceMeta {
    nodeId: string;
    componentName?: string;
    sourceFile: string;
    sourceLine?: number;
    sourceColumn?: number;
    routeFile?: string;
    tagName?: string;
}
export declare function registerHiggsfieldDesignElement(element: Element | null, meta: HiggsfieldDesignSourceMeta): void;
export declare function createHiggsfieldDesignRef<T extends Element>(meta: HiggsfieldDesignSourceMeta): RefCallback<T>;
export declare function composeHiggsfieldDesignRefs<T extends Element>(ref: Ref<T> | undefined | null, designRef: RefCallback<T>): RefCallback<T>;
export declare function getHiggsfieldDesignMeta(element: Element): HiggsfieldDesignSourceMeta | undefined;
export declare function findHiggsfieldDesignElement(target: Element): {
    element: any;
    meta: HiggsfieldDesignSourceMeta;
} | null;
//# sourceMappingURL=registry.d.ts.map