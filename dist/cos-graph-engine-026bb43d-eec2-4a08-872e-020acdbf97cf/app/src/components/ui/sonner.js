"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Toaster = void 0;
const sonner_1 = require("sonner");
const Toaster = ({ ...props }) => {
    return (<sonner_1.Toaster className="toaster group" toastOptions={{
            classNames: {
                toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
                description: "group-[.toast]:text-muted-foreground",
                actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            },
        }} {...props}/>);
};
exports.Toaster = Toaster;
//# sourceMappingURL=sonner.js.map