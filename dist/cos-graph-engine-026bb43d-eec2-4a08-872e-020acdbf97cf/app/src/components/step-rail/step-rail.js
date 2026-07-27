"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepRail = StepRail;
const use_render_1 = require("@base-ui/react/use-render");
const check_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/check.svg?react"));
const icon_1 = require("@higgsfield/quanta/icon");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
/** The numbered circle — brand check (complete), brand number (current), muted (upcoming). */
function StepBadge({ index, state }) {
    return (<span className={(0, utils_1.cn)('flex size-7 shrink-0 items-center justify-center rounded-q-full text-q-body-sm-semi-bold transition-colors', state === 'upcoming'
            ? 'bg-q-transparent-light-10 text-q-text-secondary'
            : 'bg-q-brand-primary text-q-text-inverse')}>
      {state === 'complete'
            ? <icon_1.Icon as={check_svg_react_1.default} size="sm"/>
            : index + 1}
    </span>);
}
function StepRail({ steps, current, reachable, onStepChange, render, className, }) {
    const currentIndex = steps.findIndex(step => step.id === current);
    const content = steps.map((step, index) => {
        const state = index < currentIndex
            ? 'complete'
            : index === currentIndex
                ? 'current'
                : 'upcoming';
        const canClick = onStepChange != null && (reachable == null || reachable.includes(step.id));
        return (<div key={step.id} className="flex min-w-0 items-center gap-3">
        {index > 0
                ? (<span aria-hidden className={(0, utils_1.cn)('h-px w-6 shrink-0 transition-colors sm:w-12', index <= currentIndex ? 'bg-q-brand-primary' : 'bg-q-border-subtle')}/>)
                : null}
        <button type="button" disabled={!canClick} aria-current={state === 'current' ? 'step' : undefined} onClick={canClick ? () => onStepChange?.(step.id) : undefined} className={(0, utils_1.cn)('flex items-center gap-2 rounded-q-full px-1 py-0.5 transition-opacity', canClick
                ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-border-focus'
                : 'cursor-default', state === 'upcoming' && 'opacity-70')}>
          <StepBadge index={index} state={state}/>
          <typography_1.Typography as="span" variant="body-sm-semi-bold" color={state === 'upcoming' ? 'secondary' : 'primary'} className="hidden truncate sm:inline">
            {step.label}
          </typography_1.Typography>
        </button>
      </div>);
    });
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'nav',
        props: {
            'aria-label': 'Progress',
            'className': (0, utils_1.cn)('flex items-center justify-center', className),
            'children': content,
        },
    });
}
//# sourceMappingURL=step-rail.js.map