"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dropdown = void 0;
const IconCheckmark2MediumOutlined_1 = require("@higgsfield-ai/icons/IconCheckmark2MediumOutlined");
const IconChevronRightMediumOutlined_1 = require("@higgsfield-ai/icons/IconChevronRightMediumOutlined");
const IconMagnifyingGlass2Outlined_1 = require("@higgsfield-ai/icons/IconMagnifyingGlass2Outlined");
const react_1 = require("react");
const menu_1 = require("@base-ui/react/menu");
const index_ts_1 = require("../checkbox/index.ts");
const index_ts_2 = require("../divider/index.ts");
const index_ts_3 = require("../not-found/index.ts");
const index_ts_4 = require("../switch/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
/* ── Search filtering ──────────────────────────────────────────────────────── */
const QueryContext = (0, react_1.createContext)('');
/**
 * Render-time match tally. The old static walk (subtreeMatches) couldn't see
 * Items wrapped in custom components, so search broke for every composed row.
 * Instead each Item bumps this counter when it actually renders (matched), and a
 * gate rendered AFTER the list reads the total — works for any composition.
 */
const MatchCountContext = (0, react_1.createContext)(null);
/** Per-Group tally (same idea, scoped) so a Group can hide when all ITS rows filter out. */
const GroupCountContext = (0, react_1.createContext)(null);
/** Pull the plain text out of an arbitrary ReactNode (best-effort, for search). */
function extractText(node) {
    if (node == null || node === false || node === true)
        return '';
    if (typeof node === 'string' || typeof node === 'number')
        return String(node);
    if (Array.isArray(node))
        return node.map(extractText).join(' ');
    if ((0, react_1.isValidElement)(node))
        return extractText(node.props.children);
    return '';
}
/** All whitespace-split terms must appear (case-insensitive substring). */
function matchQuery(text, query) {
    if (!query)
        return true;
    const haystack = text.toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every(term => haystack.includes(term));
}
/** Searchable / selection-key text for an Item: explicit `value`, else its `title`, else its children. */
function itemText(props) {
    if (props.value != null)
        return props.value;
    const fromTitle = extractText(props.title);
    return fromTitle || extractText(props.children);
}
const SelectionContext = (0, react_1.createContext)(null);
const noop = () => { };
const OpenContext = (0, react_1.createContext)({
    open: false,
    openOnHover: false,
    scheduleHoverOpen: noop,
    scheduleHoverClose: noop,
    cancelHoverClose: noop,
});
const HOVER_OPEN_DELAY = 80;
const HOVER_CLOSE_DELAY = 120;
const ItemContext = (0, react_1.createContext)({
    checked: false,
    disabled: false,
    selectable: false,
});
function Trigger({ className, onPointerEnter, onPointerLeave, ...props }) {
    const { open, openOnHover, scheduleHoverOpen, scheduleHoverClose, cancelHoverClose } = (0, react_1.useContext)(OpenContext);
    const handlePointerEnter = (0, react_1.useCallback)((event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented && openOnHover) {
            cancelHoverClose();
            scheduleHoverOpen();
        }
    }, [cancelHoverClose, onPointerEnter, openOnHover, scheduleHoverOpen]);
    const handlePointerLeave = (0, react_1.useCallback)((event) => {
        onPointerLeave?.(event);
        if (!event.defaultPrevented && openOnHover)
            scheduleHoverClose();
    }, [onPointerLeave, openOnHover, scheduleHoverClose]);
    return (<menu_1.Menu.Trigger {...props} className={(0, cx_ts_1.cx)('q-dropdown-trigger', className)} data-open={open ? '' : undefined} data-popup-open={open ? '' : undefined} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}/>);
}
/**
 * Root owns selection state. Uncontrolled by default (internal `useState`
 * seeded by `defaultSelected`); pass `selected` to control it. Either way,
 * `onSelected` fires with the next array on every change.
 */
function Root({ open, defaultOpen, onOpenChange, selected, defaultSelected, onSelected, selectionMode = 'multiple', openOnHover = false, ...props }) {
    const [internal, setInternal] = (0, react_1.useState)(defaultSelected ?? []);
    const [internalOpen, setInternalOpen] = (0, react_1.useState)(defaultOpen ?? false);
    const hoverOpenTimeoutRef = (0, react_1.useRef)(null);
    const hoverCloseTimeoutRef = (0, react_1.useRef)(null);
    const isControlled = selected != null;
    const current = isControlled ? selected : internal;
    const isOpenControlled = open != null;
    const currentOpen = isOpenControlled ? open : internalOpen;
    const isSelected = (0, react_1.useCallback)((value) => current.includes(value), [current]);
    const toggle = (0, react_1.useCallback)((value, next) => {
        const compute = (prev) => {
            if (selectionMode === 'single')
                return next ? [value] : prev.filter(v => v !== value);
            if (next)
                return prev.includes(value) ? prev : [...prev, value];
            return prev.filter(v => v !== value);
        };
        if (isControlled) {
            onSelected?.(compute(current));
        }
        else {
            setInternal((prev) => {
                const nextState = compute(prev);
                onSelected?.(nextState);
                return nextState;
            });
        }
    }, [current, isControlled, onSelected, selectionMode]);
    const ctx = (0, react_1.useMemo)(() => ({ selected: current, isSelected, toggle }), [current, isSelected, toggle]);
    const cancelHoverOpen = (0, react_1.useCallback)(() => {
        if (hoverOpenTimeoutRef.current == null)
            return;
        clearTimeout(hoverOpenTimeoutRef.current);
        hoverOpenTimeoutRef.current = null;
    }, []);
    const cancelHoverClose = (0, react_1.useCallback)(() => {
        if (hoverCloseTimeoutRef.current == null)
            return;
        clearTimeout(hoverCloseTimeoutRef.current);
        hoverCloseTimeoutRef.current = null;
    }, []);
    const updateOpen = (0, react_1.useCallback)((next, event) => {
        cancelHoverOpen();
        cancelHoverClose();
        if (currentOpen === next)
            return;
        if (!isOpenControlled)
            setInternalOpen(next);
        onOpenChange?.(next, event);
    }, [cancelHoverClose, cancelHoverOpen, currentOpen, isOpenControlled, onOpenChange]);
    const scheduleHoverOpen = (0, react_1.useCallback)(() => {
        if (!openOnHover || currentOpen)
            return;
        cancelHoverClose();
        cancelHoverOpen();
        hoverOpenTimeoutRef.current = setTimeout(() => {
            hoverOpenTimeoutRef.current = null;
            updateOpen(true);
        }, HOVER_OPEN_DELAY);
    }, [cancelHoverClose, cancelHoverOpen, currentOpen, openOnHover, updateOpen]);
    const scheduleHoverClose = (0, react_1.useCallback)(() => {
        if (!openOnHover)
            return;
        cancelHoverOpen();
        cancelHoverClose();
        hoverCloseTimeoutRef.current = setTimeout(() => updateOpen(false), HOVER_CLOSE_DELAY);
    }, [cancelHoverClose, cancelHoverOpen, openOnHover, updateOpen]);
    const openCtx = (0, react_1.useMemo)(() => ({ open: currentOpen, openOnHover, scheduleHoverOpen, scheduleHoverClose, cancelHoverClose }), [cancelHoverClose, currentOpen, openOnHover, scheduleHoverClose, scheduleHoverOpen]);
    const handleOpenChange = (0, react_1.useCallback)((next, event) => {
        updateOpen(next, event);
    }, [updateOpen]);
    (0, react_1.useEffect)(() => () => {
        cancelHoverOpen();
        cancelHoverClose();
    }, [cancelHoverClose, cancelHoverOpen]);
    return (<OpenContext.Provider value={openCtx}>
      <SelectionContext.Provider value={ctx}>
        <menu_1.Menu.Root open={currentOpen} onOpenChange={handleOpenChange} {...props}/>
      </SelectionContext.Provider>
    </OpenContext.Provider>);
}
const SIZE_CLASS = {
    compact: 'q-dropdown-content-compact',
    default: '',
    large: 'q-dropdown-content-large',
};
const SURFACE_CLASS = {
    glass: '',
    solid: 'q-dropdown-content-solid',
};
const SHAPE_CLASS = {
    default: '',
    panel: 'q-dropdown-content-panel',
};
function contentClass(size, surface, shape, className) {
    return (0, cx_ts_1.cx)('q-dropdown-content', SIZE_CLASS[size], SURFACE_CLASS[surface], SHAPE_CLASS[shape], className);
}
function Content({ className, positionerClassName, size = 'default', surface = 'glass', shape = 'default', side = 'bottom', align = 'start', sideOffset = 4, alignOffset, collisionPadding, container, withSearch = false, searchPlaceholder = 'Search', notFound, children, onPointerEnter, onPointerLeave, ...props }) {
    const { openOnHover, scheduleHoverClose, cancelHoverClose } = (0, react_1.useContext)(OpenContext);
    const handlePointerEnter = (0, react_1.useCallback)((event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented && openOnHover)
            cancelHoverClose();
    }, [cancelHoverClose, onPointerEnter, openOnHover]);
    const handlePointerLeave = (0, react_1.useCallback)((event) => {
        onPointerLeave?.(event);
        if (!event.defaultPrevented && openOnHover)
            scheduleHoverClose();
    }, [onPointerLeave, openOnHover, scheduleHoverClose]);
    return (<menu_1.Menu.Portal container={container}>
      <menu_1.Menu.Positioner className={positionerClassName} side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={collisionPadding}>
        <menu_1.Menu.Popup className={contentClass(size, surface, shape, className)} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} {...props}>
          <SearchableContent withSearch={withSearch} placeholder={searchPlaceholder} notFound={notFound}>
            {children}
          </SearchableContent>
        </menu_1.Menu.Popup>
      </menu_1.Menu.Positioner>
    </menu_1.Menu.Portal>);
}
/** Holds query state INSIDE the popup so it resets every time the menu reopens. */
function SearchableContent({ withSearch, placeholder, notFound, children, }) {
    const [query, setQuery] = (0, react_1.useState)('');
    const inputRef = (0, react_1.useRef)(null);
    const rootRef = (0, react_1.useRef)(null);
    // Keep focus in the search field after Base UI's open-focus settles.
    (0, react_1.useEffect)(() => {
        if (!withSearch)
            return;
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [withSearch]);
    if (!withSearch)
        return <>{children}</>;
    const focusFirstItem = () => {
        const first = rootRef.current?.querySelector('[role^="menuitem"]:not([data-disabled])');
        first?.focus();
    };
    // Fresh per render: Items bump it as they render; SearchEmpty (last) reads it.
    const matchCount = { n: 0 };
    return (<div ref={rootRef} className="q-dropdown-search-wrap">
      <div className="q-dropdown-search">
        <span className="q-dropdown-search-icon"><IconMagnifyingGlass2Outlined_1.IconMagnifyingGlass2Outlined /></span>
        <input ref={inputRef} className="q-dropdown-search-input" placeholder={placeholder} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={(e) => {
            // Base UI's menu treats the popup as a composite widget and
            // preventDefaults typing for typeahead. Keep the input editable by
            // stopping keystrokes from reaching the menu — except navigation
            // keys we explicitly want the menu (or us) to handle.
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusFirstItem();
                return;
            }
            if (e.key === 'Escape')
                return; // let it bubble so the menu closes
            e.stopPropagation();
        }}/>
      </div>
      <index_ts_2.Divider className="shrink-0"/>
      <QueryContext.Provider value={query}>
        <MatchCountContext.Provider value={matchCount}>
          {children}
          <SearchEmpty fallback={notFound}/>
        </MatchCountContext.Provider>
      </QueryContext.Provider>
    </div>);
}
/** Rendered LAST in the search scope, so the match tally is complete: shows the
 * NotFound fallback iff the query matched nothing. Composition-safe — no static
 * introspection of children (which broke for wrapped Items). */
function SearchEmpty({ fallback }) {
    const query = (0, react_1.useContext)(QueryContext);
    const matchCount = (0, react_1.useContext)(MatchCountContext);
    if (query !== '' && matchCount != null && matchCount.n === 0)
        return <>{fallback ?? <index_ts_3.NotFound title="No results found" subtitle="Try a different search"/>}</>;
    return null;
}
function Separator({ className, ...props }) {
    return <menu_1.Menu.Separator render={<index_ts_2.Divider />} className={(0, cx_ts_1.cx)('shrink-0', className)} {...props}/>;
}
function Group({ className, children, ...props }) {
    const query = (0, react_1.useContext)(QueryContext);
    const [empty, setEmpty] = (0, react_1.useState)(false);
    // A wrapped Item only reveals its match by rendering, so tally the Group's own
    // rendered rows (composition-safe) and hide the group when none survived. The
    // counter is fresh each render; children bump it before this layout effect reads it.
    const groupCount = { n: 0 };
    (0, react_1.useLayoutEffect)(() => {
        setEmpty(query !== '' && groupCount.n === 0);
    });
    if (empty)
        return null;
    return (<menu_1.Menu.Group className={(0, cx_ts_1.cx)('q-dropdown-group', className)} {...props}>
      <GroupCountContext.Provider value={groupCount}>{children}</GroupCountContext.Provider>
    </menu_1.Menu.Group>);
}
/** Section label (Figma _MenuLabel). Standalone, or as a Group's heading.
 * Reuses the shared `q-menu-group-label` primitive (also used by cmdk). */
function Label({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-menu-group-label', className)} {...props}/>;
}
function ItemIcon({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-icon', className)} {...props}/>;
}
/** Leading media tile (image/icon, 36px) for rich rows. */
function ItemMedia({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-dropdown-item-media', className)} {...props}/>;
}
/** Content column — stacks the title row and description (Figma 2px gap). */
function ItemContent({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-label', className)} {...props}/>;
}
function ItemTitleRow({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-title-row', className)} {...props}/>;
}
function ItemTitle({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-title', className)} {...props}/>;
}
function ItemDescription({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-description', className)} {...props}/>;
}
/** Inline meta inside the title row (e.g. a count). */
function ItemMeta({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-dropdown-item-meta', className)} {...props}/>;
}
/** Trailing slot — count, indicator, chevron, button… (pushed to the right). */
function ItemTrailing({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-trailing', className)} {...props}/>;
}
/** Small inset metadata chip. */
function ItemMetaChip({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-dropdown-meta-chip', className)} {...props}/>;
}
/** Submenu affordance chevron for use inside a SubTrigger's ItemTrailing. */
function ItemSubChevron({ className }) {
    return <IconChevronRightMediumOutlined_1.IconChevronRightMediumOutlined className={(0, cx_ts_1.cx)('q-dropdown-check', className)}/>;
}
/**
 * Selection indicator for a `selectable` Item. Reads the row's checked state
 * from context, so place it anywhere (typically inside ItemTrailing). The
 * `indicator` style mirrors a real Checkbox / Switch, or a trailing check.
 */
function ItemIndicator({ indicator = 'check' }) {
    const { checked } = (0, react_1.useContext)(ItemContext);
    if (indicator === 'checkbox')
        return <index_ts_1.Checkbox checked={checked} size="sm" tabIndex={-1} aria-hidden className="pointer-events-none"/>;
    if (indicator === 'switch')
        return <index_ts_4.Switch checked={checked} size="small" tabIndex={-1} aria-hidden className="pointer-events-none"/>;
    return checked ? <IconCheckmark2MediumOutlined_1.IconCheckmark2MediumOutlined className="q-dropdown-check"/> : null;
}
function Item(props) {
    const { className, value, selectable = false, disabled, danger = false, checked, onCheckedChange, onSelect, start, media, title, subtitle, badge, end, indicator = 'check', children, ...rest } = props;
    const query = (0, react_1.useContext)(QueryContext);
    const selection = (0, react_1.useContext)(SelectionContext);
    const matchCount = (0, react_1.useContext)(MatchCountContext);
    const groupCount = (0, react_1.useContext)(GroupCountContext);
    // Internal fallback state so a `selectable` row works with NO value/handlers.
    const [selfChecked, setSelfChecked] = (0, react_1.useState)(false);
    const disabledState = disabled === true;
    // Filter when searching.
    if (query && !matchQuery(itemText(props), query))
        return null;
    // Survived the filter (or not searching) → tally for the NotFound gate
    // (top-level) and for its Group (so an all-filtered group hides itself).
    if (matchCount)
        matchCount.n++;
    if (groupCount)
        groupCount.n++;
    // Slot rendering activates only when a slot is passed; otherwise `children`
    // render verbatim (back-compat with the fully-composed API).
    const hasSlots = title != null || subtitle != null || start != null || media != null || badge != null || end != null;
    const body = hasSlots
        ? (<>
          {media != null ? <ItemMedia>{media}</ItemMedia> : start != null ? <ItemIcon>{start}</ItemIcon> : null}
          {title != null || subtitle != null || badge != null
                ? (<ItemContent>
                  <ItemTitleRow>
                    {title != null ? <ItemTitle>{title}</ItemTitle> : null}
                    {badge}
                  </ItemTitleRow>
                  {subtitle != null ? <ItemDescription>{subtitle}</ItemDescription> : null}
                </ItemContent>)
                : null}
          {end != null || selectable
                ? <ItemTrailing>{end}{selectable ? <ItemIndicator indicator={indicator}/> : null}</ItemTrailing>
                : null}
        </>)
        : children;
    // Non-selectable → plain action item (closes on click, no selection state).
    if (!selectable) {
        return (<ItemContext.Provider value={{ checked: false, disabled: disabledState, selectable: false, value }}>
        <menu_1.Menu.Item className={(0, cx_ts_1.cx)('q-menu-item', danger && 'q-menu-item-danger', className)} disabled={disabled} onClick={onSelect} {...rest}>
          {body}
        </menu_1.Menu.Item>
      </ItemContext.Provider>);
    }
    // Selectable → stateful checkbox row, stays open on toggle. The checked state
    // lives in (priority): the controlled `checked` prop → Root, keyed by the
    // resolved value → the row's own internal state. `onCheckedChange` always
    // fires, so a consumer only ever needs to pass a handler (never wire state).
    const resolvedValue = itemText(props);
    const controlled = checked !== undefined;
    const rootKeyed = !controlled && selection != null && resolvedValue !== '';
    const resolvedChecked = controlled ? checked : rootKeyed ? selection.isSelected(resolvedValue) : selfChecked;
    const handleCheckedChange = (next, event) => {
        if (rootKeyed)
            selection.toggle(resolvedValue, next);
        else if (!controlled)
            setSelfChecked(next);
        onCheckedChange?.(next, event);
    };
    return (<ItemContext.Provider value={{ checked: resolvedChecked, disabled: disabledState, selectable: true, value: value ?? (resolvedValue || undefined) }}>
      <menu_1.Menu.CheckboxItem className={(0, cx_ts_1.cx)('q-menu-item', danger && 'q-menu-item-danger', className)} checked={resolvedChecked} onCheckedChange={handleCheckedChange} disabled={disabled} closeOnClick={false} {...rest}>
        {body}
      </menu_1.Menu.CheckboxItem>
    </ItemContext.Provider>);
}
/* ── Submenu (explicit, composable) ────────────────────────────────────────── */
function Sub({ children, ...props }) {
    // Submenus stay visible during search (their trigger label isn't filtered);
    // nested items self-filter via their own QueryContext when the submenu opens.
    return <menu_1.Menu.SubmenuRoot {...props}>{children}</menu_1.Menu.SubmenuRoot>;
}
function SubTrigger({ className, disabled, start, title, subtitle, end, children, ...props }) {
    const hasSlots = title != null || subtitle != null || start != null || end != null;
    return (<menu_1.Menu.SubmenuTrigger className={(0, cx_ts_1.cx)('q-menu-item', 'q-dropdown-submenu-trigger', className)} disabled={disabled} {...props}>
      {hasSlots
            ? (<>
              {start != null ? <ItemIcon>{start}</ItemIcon> : null}
              {title != null || subtitle != null
                    ? (<ItemContent>
                      {title != null ? <ItemTitleRow><ItemTitle>{title}</ItemTitle></ItemTitleRow> : null}
                      {subtitle != null ? <ItemDescription>{subtitle}</ItemDescription> : null}
                    </ItemContent>)
                    : null}
              <ItemTrailing>{end}<ItemSubChevron /></ItemTrailing>
            </>)
            : children}
    </menu_1.Menu.SubmenuTrigger>);
}
function SubContent({ className, sideOffset = 4, alignOffset = -8, container, children, ...props }) {
    return (<menu_1.Menu.Portal container={container}>
      <menu_1.Menu.Positioner side="right" align="start" sideOffset={sideOffset + 8} alignOffset={alignOffset}>
        <menu_1.Menu.Popup className={(0, cx_ts_1.cx)('q-dropdown-content', className)} {...props}>
          {/* Reset the query so sub-items aren't filtered by the parent search. */}
          <QueryContext.Provider value="">{children}</QueryContext.Provider>
        </menu_1.Menu.Popup>
      </menu_1.Menu.Positioner>
    </menu_1.Menu.Portal>);
}
exports.Dropdown = {
    Root,
    Trigger,
    Content,
    Group,
    Label,
    Separator,
    Item,
    ItemIcon,
    ItemMedia,
    ItemContent,
    ItemTitleRow,
    ItemTitle,
    ItemDescription,
    ItemMeta,
    ItemTrailing,
    ItemMetaChip,
    ItemIndicator,
    ItemSubChevron,
    Sub,
    SubTrigger,
    SubContent,
};
//# sourceMappingURL=dropdown.js.map