"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Calendar = Calendar;
exports.CalendarDayButton = CalendarDayButton;
const React = __importStar(require("react"));
const keyboard_arrow_down_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?react"));
const chevron_left_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/chevron_left.svg?react"));
const chevron_right_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/chevron_right.svg?react"));
const react_day_picker_1 = require("react-day-picker");
const utils_1 = require("@/lib/utils");
const button_1 = require("@/components/ui/button");
function Calendar({ className, classNames, showOutsideDays = true, captionLayout = "label", buttonVariant = "ghost", formatters, components, ...props }) {
    const defaultClassNames = (0, react_day_picker_1.getDefaultClassNames)();
    return (<react_day_picker_1.DayPicker showOutsideDays={showOutsideDays} className={(0, utils_1.cn)("bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent", String.raw `rtl:**:[.rdp-button\_next>svg]:rotate-180`, String.raw `rtl:**:[.rdp-button\_previous>svg]:rotate-180`, className)} captionLayout={captionLayout} formatters={{
            formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
            ...formatters,
        }} classNames={{
            root: (0, utils_1.cn)("w-fit", defaultClassNames.root),
            months: (0, utils_1.cn)("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
            month: (0, utils_1.cn)("flex w-full flex-col gap-4", defaultClassNames.month),
            nav: (0, utils_1.cn)("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaultClassNames.nav),
            button_previous: (0, utils_1.cn)((0, button_1.buttonVariants)({ variant: buttonVariant }), "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50", defaultClassNames.button_previous),
            button_next: (0, utils_1.cn)((0, button_1.buttonVariants)({ variant: buttonVariant }), "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50", defaultClassNames.button_next),
            month_caption: (0, utils_1.cn)("flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)", defaultClassNames.month_caption),
            dropdowns: (0, utils_1.cn)("flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium", defaultClassNames.dropdowns),
            dropdown_root: (0, utils_1.cn)("has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border", defaultClassNames.dropdown_root),
            dropdown: (0, utils_1.cn)("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
            caption_label: (0, utils_1.cn)("select-none font-medium", captionLayout === "label"
                ? "text-sm"
                : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5", defaultClassNames.caption_label),
            table: "w-full border-collapse",
            weekdays: (0, utils_1.cn)("flex", defaultClassNames.weekdays),
            weekday: (0, utils_1.cn)("text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal", defaultClassNames.weekday),
            week: (0, utils_1.cn)("mt-2 flex w-full", defaultClassNames.week),
            week_number_header: (0, utils_1.cn)("w-(--cell-size) select-none", defaultClassNames.week_number_header),
            week_number: (0, utils_1.cn)("text-muted-foreground select-none text-[0.8rem]", defaultClassNames.week_number),
            day: (0, utils_1.cn)("group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md", defaultClassNames.day),
            range_start: (0, utils_1.cn)("bg-accent rounded-l-md", defaultClassNames.range_start),
            range_middle: (0, utils_1.cn)("rounded-none", defaultClassNames.range_middle),
            range_end: (0, utils_1.cn)("bg-accent rounded-r-md", defaultClassNames.range_end),
            today: (0, utils_1.cn)("bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none", defaultClassNames.today),
            outside: (0, utils_1.cn)("text-muted-foreground aria-selected:text-muted-foreground", defaultClassNames.outside),
            disabled: (0, utils_1.cn)("text-muted-foreground opacity-50", defaultClassNames.disabled),
            hidden: (0, utils_1.cn)("invisible", defaultClassNames.hidden),
            ...classNames,
        }} components={{
            Root: ({ className, rootRef, ...props }) => {
                return <div data-slot="calendar" ref={rootRef} className={(0, utils_1.cn)(className)} {...props}/>;
            },
            Chevron: ({ className, orientation, ...props }) => {
                if (orientation === "left") {
                    return <chevron_left_svg_react_1.default className={(0, utils_1.cn)("size-4", className)} {...props}/>;
                }
                if (orientation === "right") {
                    return <chevron_right_svg_react_1.default className={(0, utils_1.cn)("size-4", className)} {...props}/>;
                }
                return <keyboard_arrow_down_svg_react_1.default className={(0, utils_1.cn)("size-4", className)} {...props}/>;
            },
            DayButton: CalendarDayButton,
            WeekNumber: ({ children, ...props }) => {
                return (<td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>);
            },
            ...components,
        }} {...props}/>);
}
function CalendarDayButton({ className, day, modifiers, ...props }) {
    const defaultClassNames = (0, react_day_picker_1.getDefaultClassNames)();
    const ref = React.useRef(null);
    React.useEffect(() => {
        if (modifiers.focused)
            ref.current?.focus();
    }, [modifiers.focused]);
    return (<button_1.Button ref={ref} variant="ghost" size="icon" data-day={day.date.toLocaleDateString()} data-selected-single={modifiers.selected &&
            !modifiers.range_start &&
            !modifiers.range_end &&
            !modifiers.range_middle} data-range-start={modifiers.range_start} data-range-end={modifiers.range_end} data-range-middle={modifiers.range_middle} className={(0, utils_1.cn)("data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70", defaultClassNames.day, className)} {...props}/>);
}
//# sourceMappingURL=calendar.js.map