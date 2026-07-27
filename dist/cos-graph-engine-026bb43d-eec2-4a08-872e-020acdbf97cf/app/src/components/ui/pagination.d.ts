import * as React from "react";
import { ButtonProps } from "@/components/ui/button";
declare const Pagination: {
    ({ className, ...props }: React.ComponentProps<"nav">): any;
    displayName: string;
};
declare const PaginationContent: any;
declare const PaginationItem: any;
type PaginationLinkProps = {
    isActive?: boolean;
} & Pick<ButtonProps, "size"> & React.ComponentProps<"a">;
declare const PaginationLink: {
    ({ className, isActive, size, ...props }: PaginationLinkProps): any;
    displayName: string;
};
declare const PaginationPrevious: {
    ({ className, ...props }: React.ComponentProps<typeof PaginationLink>): any;
    displayName: string;
};
declare const PaginationNext: {
    ({ className, ...props }: React.ComponentProps<typeof PaginationLink>): any;
    displayName: string;
};
declare const PaginationEllipsis: {
    ({ className, ...props }: React.ComponentProps<"span">): any;
    displayName: string;
};
export { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis, };
//# sourceMappingURL=pagination.d.ts.map