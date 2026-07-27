import { Group, Separator } from "react-resizable-panels";
declare const ResizablePanelGroup: ({ className, ...props }: React.ComponentProps<typeof Group>) => any;
declare const ResizablePanel: any;
declare const ResizableHandle: ({ withHandle, className, ...props }: React.ComponentProps<typeof Separator> & {
    withHandle?: boolean;
}) => any;
export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
//# sourceMappingURL=resizable.d.ts.map