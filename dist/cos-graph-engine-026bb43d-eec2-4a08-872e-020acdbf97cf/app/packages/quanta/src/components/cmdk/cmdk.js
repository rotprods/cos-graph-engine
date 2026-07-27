"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Command = void 0;
exports.CommandInput = CommandInput;
exports.CommandList = CommandList;
exports.CommandEmpty = CommandEmpty;
exports.CommandLoading = CommandLoading;
exports.CommandGroup = CommandGroup;
exports.CommandItem = CommandItem;
exports.CommandItemIcon = CommandItemIcon;
exports.CommandItemContent = CommandItemContent;
exports.CommandItemTitle = CommandItemTitle;
exports.CommandItemDescription = CommandItemDescription;
exports.CommandItemTrailing = CommandItemTrailing;
exports.CommandSeparator = CommandSeparator;
exports.CommandShortcut = CommandShortcut;
exports.CommandBody = CommandBody;
exports.CommandDetail = CommandDetail;
exports.CommandFooter = CommandFooter;
exports.CommandAction = CommandAction;
exports.CommandDialog = CommandDialog;
const IconMagnifyingGlass2Outlined_1 = require("@higgsfield-ai/icons/IconMagnifyingGlass2Outlined");
const react_1 = require("react");
const index_ts_1 = require("../divider/index.ts");
const index_ts_2 = require("../icon/index.ts");
const index_ts_3 = require("../input/index.ts");
const index_ts_4 = require("../kbd/index.ts");
const index_ts_5 = require("../modal/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
/**
 * Command (cmdk) — a fast, filterable command palette skinned with quanta
 * tokens. Hand-rolled (like the `cmdk` library) for an always-open, inline,
 * grouped, keyboard-driven list: fuzzy filtering, roving arrow-key navigation,
 * groups with headings, empty + loading states, per-item detail / action, and an
 * optional `⌘K` Dialog shell composed from Modal (Base UI Dialog owns the
 * overlay, focus trap and a11y through the shared modal).
 *
 * COMPOSITION-FIRST (same rules as Dropdown). `Command.Item` is a styled,
 * stateful row that renders whatever children you give it — it owns the
 * registry / filtering / highlight / selection behaviour, but makes NO
 * assumption about the shape of your data. Build any row out of the exported
 * parts (`ItemIcon` / `ItemContent` / `ItemTitle` / `ItemDescription` /
 * `ItemTrailing`), exactly like `Dropdown.Item`:
 *
 *   <Command.Dialog shortcut="mod+k" label="Command menu">
 *     <Command.Input placeholder="Type a command…" />
 *     <Command.List>
 *       <Command.Empty>No results.</Command.Empty>
 *       <Command.Group heading="Actions">
 *         <Command.Item onSelect={…}>
 *           <Command.ItemIcon><Icon><Plus/></Icon></Command.ItemIcon>
 *           <Command.ItemTitle>New file</Command.ItemTitle>
 *           <Command.ItemTrailing><Command.Shortcut>⌘N</Command.Shortcut></Command.ItemTrailing>
 *         </Command.Item>
 *       </Command.Group>
 *     </Command.List>
 *   </Command.Dialog>
 *
 * An Item's searchable text is its `value` prop, or — when omitted — the plain
 * text of its children; `keywords` adds extra search terms. `Command.Root`
 * accepts a custom `filter`, `loading` (suppresses Empty), and `loop` (default).
 */
/* ── Fuzzy match: substring (strong) or subsequence (weak); empty query = all. */
function score(query, text) {
    if (!query)
        return 1;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    if (t.includes(q))
        return 2;
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi])
            qi++;
    }
    return qi === q.length ? 1 : 0;
}
/** Best-effort plain text from an arbitrary node (for matching). */
function nodeText(node) {
    if (node == null || node === false || node === true)
        return '';
    if (typeof node === 'string' || typeof node === 'number')
        return String(node);
    if (Array.isArray(node))
        return node.map(nodeText).join(' ');
    if ((0, react_1.isValidElement)(node))
        return nodeText(node.props.children);
    return '';
}
const defaultFilter = (value, search, keywords) => score(search, `${value} ${keywords}`.trim());
/** Populate every ref in `refs` with the same node (object or callback refs). */
function mergeRefs(...refs) {
    return (node) => {
        for (const ref of refs) {
            if (typeof ref === 'function')
                ref(node);
            else if (ref)
                ref.current = node;
        }
    };
}
const CommandContext = (0, react_1.createContext)(null);
function useCommand() {
    const ctx = (0, react_1.useContext)(CommandContext);
    if (!ctx)
        throw new Error('Command parts must be used within <Command>');
    return ctx;
}
/* The group a nested Item belongs to (null at top level). */
const GroupContext = (0, react_1.createContext)(null);
/** Root: owns search + the item registry + keyboard navigation. */
function CommandRoot({ value, defaultValue = '', onValueChange, shouldFilter = true, filter, loading = false, loop = true, label = 'Command menu', className, children, ...props }) {
    const [uncontrolled, setUncontrolled] = (0, react_1.useState)(defaultValue);
    const query = value ?? uncontrolled;
    const setQuery = (0, react_1.useCallback)((q) => {
        if (value === undefined)
            setUncontrolled(q);
        onValueChange?.(q);
    }, [value, onValueChange]);
    const listId = (0, react_1.useId)();
    const registry = (0, react_1.useRef)(new Map());
    const selects = (0, react_1.useRef)(new Map());
    const [version, setVersion] = (0, react_1.useState)(0);
    const [activeId, setActiveId] = (0, react_1.useState)(null);
    const [activeDetail, setActiveDetail] = (0, react_1.useState)(null);
    const [activeAction, setActiveAction] = (0, react_1.useState)(null);
    const listRef = (0, react_1.useRef)(null);
    const register = (0, react_1.useCallback)((meta, onSelect) => {
        registry.current.set(meta.id, meta);
        if (onSelect)
            selects.current.set(meta.id, onSelect);
        setVersion(v => v + 1);
        return () => {
            registry.current.delete(meta.id);
            selects.current.delete(meta.id);
            setVersion(v => v + 1);
        };
    }, []);
    const matched = (0, react_1.useMemo)(() => {
        const set = new Set();
        const scorer = filter ?? defaultFilter;
        for (const [id, meta] of registry.current) {
            if (!shouldFilter || scorer(meta.value, query, meta.keywords) > 0)
                set.add(id);
        }
        return set;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, version, shouldFilter, filter]);
    const groupHasMatch = (0, react_1.useCallback)((groupId) => {
        for (const [id, meta] of registry.current) {
            if (meta.groupId === groupId && matched.has(id))
                return true;
        }
        return false;
    }, [matched]);
    const select = (0, react_1.useCallback)((id) => {
        if (registry.current.get(id)?.disabled)
            return;
        selects.current.get(id)?.();
    }, []);
    /** Visible item ids in DOM order (source of truth for nav). */
    const visibleIds = (0, react_1.useCallback)(() => {
        const root = listRef.current;
        if (!root)
            return [];
        return Array.from(root.querySelectorAll('[data-command-item]:not([hidden]):not([aria-disabled="true"])'))
            .map(el => el.id);
    }, []);
    // Reset / clamp the active item whenever the visible set changes.
    (0, react_1.useEffect)(() => {
        const ids = visibleIds();
        if (ids.length === 0) {
            setActiveId(null);
            return;
        }
        setActiveId(prev => (prev && ids.includes(prev) ? prev : ids[0]));
    }, [matched, visibleIds]);
    // Keep the active item scrolled into view.
    (0, react_1.useEffect)(() => {
        if (!activeId)
            return;
        const el = listRef.current?.querySelector(`#${CSS.escape(activeId)}`);
        el?.scrollIntoView?.({ block: 'nearest' });
    }, [activeId]);
    const onKeyDown = (0, react_1.useCallback)((e) => {
        const ids = visibleIds();
        if (ids.length === 0)
            return;
        const i = activeId ? ids.indexOf(activeId) : -1;
        const goNext = () => {
            const next = i + 1;
            setActiveId(ids[next >= ids.length ? (loop ? 0 : ids.length - 1) : next]);
        };
        const goPrev = () => {
            const prev = i - 1;
            setActiveId(ids[prev < 0 ? (loop ? ids.length - 1 : 0) : prev]);
        };
        // Vim-style navigation: Ctrl+n / Ctrl+p (down / up).
        if (e.ctrlKey && (e.key === 'n' || e.key === 'p')) {
            e.preventDefault();
            e.key === 'n' ? goNext() : goPrev();
        }
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            goNext();
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            goPrev();
        }
        else if (e.key === 'Home') {
            e.preventDefault();
            setActiveId(ids[0]);
        }
        else if (e.key === 'End') {
            e.preventDefault();
            setActiveId(ids[ids.length - 1]);
        }
        else if (e.key === 'Enter' && activeId) {
            e.preventDefault();
            select(activeId);
        }
    }, [activeId, loop, select, visibleIds]);
    const ctx = (0, react_1.useMemo)(() => ({
        query, matched, loading, activeId, setActiveId, register, select, groupHasMatch, listId,
        activeDetail, setActiveDetail, activeAction, setActiveAction,
    }), [query, matched, loading, activeId, register, select, groupHasMatch, listId, activeDetail, activeAction]);
    return (<CommandContext.Provider value={ctx}>
      <div className={(0, cx_ts_1.cx)('q-command', className)} onKeyDown={onKeyDown} 
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    {...props}>
        <SearchSync query={query} setQuery={setQuery} listId={listId} label={label} listRef={listRef}>
          {children}
        </SearchSync>
      </div>
    </CommandContext.Provider>);
}
const SearchContext = (0, react_1.createContext)(null);
function SearchSync({ children, ...ctx }) {
    return <SearchContext.Provider value={ctx}>{children}</SearchContext.Provider>;
}
/** The search box — drives the filter; arrow keys navigate the list. */
function CommandInput({ start = <index_ts_2.Icon size="md"><IconMagnifyingGlass2Outlined_1.IconMagnifyingGlass2Outlined /></index_ts_2.Icon>, className, placeholder = 'Type a command or search…', ...props }) {
    const search = (0, react_1.useContext)(SearchContext);
    const { activeId, listId } = useCommand();
    const setSearchQuery = search?.setQuery;
    const handleChange = (0, react_1.useCallback)((event) => {
        setSearchQuery?.(event.target.value);
    }, [setSearchQuery]);
    if (!search)
        throw new Error('Command.Input must be used within <Command>');
    return (<div className="q-command-input-row">
      <index_ts_3.Input {...props} className={className} value={search.query} onChange={handleChange} placeholder={placeholder} start={start} role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeId ?? undefined} autoComplete="off" autoCorrect="off" spellCheck={false}/>
    </div>);
}
/** Scrollable listbox region. */
function CommandList({ ref, className, children, ...props }) {
    const search = (0, react_1.useContext)(SearchContext);
    if (!search)
        throw new Error('Command.List must be used within <Command>');
    return (<div ref={mergeRefs(search.listRef, ref)} id={search.listId} role="listbox" aria-label={search.label} className={(0, cx_ts_1.cx)('q-command-list', className)} {...props}>
      {children}
    </div>);
}
/** Shown only when the query matches nothing — and never while loading. */
function CommandEmpty({ className, children = 'No results found.', ...props }) {
    const { matched, loading } = useCommand();
    if (loading || matched.size > 0)
        return null;
    return <div className={(0, cx_ts_1.cx)('q-command-empty', className)} role="presentation" {...props}>{children}</div>;
}
/** Render inside the list while results load (pair with `loading` on Command). */
function CommandLoading({ className, children = 'Loading…', ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-command-loading', className)} role="presentation" {...props}>{children}</div>;
}
/** A labelled group; hides itself (and its heading) when nothing inside matches. */
function CommandGroup({ heading, className, children, ...props }) {
    const groupId = (0, react_1.useId)();
    const { groupHasMatch } = useCommand();
    const visible = groupHasMatch(groupId);
    return (<GroupContext.Provider value={groupId}>
      <div className={(0, cx_ts_1.cx)('q-command-group', className)} role="group" hidden={!visible} {...props}>
        {heading != null ? <div className="q-command-group-heading" aria-hidden>{heading}</div> : null}
        {children}
      </div>
    </GroupContext.Provider>);
}
/**
 * A selectable command row. Compose it from the exported parts (`ItemIcon` /
 * `ItemContent` / `ItemTitle` / `ItemDescription` / `ItemTrailing`), mirroring
 * `Dropdown.Item`. It registers itself for keyboard navigation and filters
 * itself out when it doesn't match the query (matched on its children's text +
 * `keywords`, or an explicit `value`).
 */
function CommandItem({ detail, action, value, keywords, disabled = false, onSelect, className, children, ...props }) {
    const id = (0, react_1.useId)();
    const groupId = (0, react_1.useContext)(GroupContext);
    const { matched, activeId, setActiveId, register, select, setActiveDetail, setActiveAction } = useCommand();
    const resolvedValue = value ?? nodeText(children);
    const resolvedKeywords = keywords ?? '';
    (0, react_1.useLayoutEffect)(() => {
        return register({ id, value: resolvedValue, keywords: resolvedKeywords, groupId, disabled }, onSelect);
        // re-register when the searchable text / disabled / group changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, resolvedValue, resolvedKeywords, groupId, disabled]);
    const visible = matched.has(id);
    const active = activeId === id;
    // When this item becomes active (hover or keyboard), publish its detail to
    // <Command.Detail> and its action label to <Command.Action>.
    (0, react_1.useEffect)(() => {
        if (active) {
            setActiveDetail(detail ?? null);
            setActiveAction(action ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);
    return (<div id={id} data-command-item="" role="option" aria-selected={active} aria-disabled={disabled || undefined} data-active={active || undefined} hidden={!visible} className={(0, cx_ts_1.cx)('q-command-item', className)} onPointerMove={() => { if (!disabled)
        setActiveId(id); }} onClick={() => select(id)} {...props}>
      {children}
    </div>);
}
/** Leading slot — icon, avatar, dot, etc. */
function CommandItemIcon({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-command-item-icon', className)} {...props}/>;
}
/** Content column — stacks the title and description. Optional: a bare
 * `Command.ItemTitle` works too (it grows + truncates on its own). */
function CommandItemContent({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-command-item-content', className)} {...props}/>;
}
/** Primary label. */
function CommandItemTitle({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-command-item-title', className)} {...props}/>;
}
/** Secondary line under the title. */
function CommandItemDescription({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-command-item-description', className)} {...props}/>;
}
/** Trailing slot — shortcut, badge, chevron, count… (pushed to the right). */
function CommandItemTrailing({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-command-item-trailing', className)} {...props}/>;
}
function CommandSeparator({ className, ...props }) {
    // The Divider component draws the etched line; this wrapper owns the spacing.
    return (<div className={(0, cx_ts_1.cx)('q-command-separator', className)} {...props}>
      <index_ts_1.Divider />
    </div>);
}
/**
 * A keyboard-shortcut pill in an item's trailing slot. Composes the canonical
 * `Kbd` (the cmdk shortcut has no bespoke design — reuse Kbd rather than
 * reinvent the pill). For multi-key combos joined by a separator use
 * `KbdSequence` directly in the item's `ItemTrailing`.
 */
function CommandShortcut(props) {
    return <index_ts_4.Kbd {...props}/>;
}
/** Row region between Input and Footer — holds the List (left) + Detail (right). */
function CommandBody({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-command-body', className)} {...props}/>;
}
/**
 * Right pane — renders the active item's `detail`. Renders nothing (so the list
 * goes full-width) when the active item carries no `detail`.
 *
 * Its content lives in an absolutely-positioned scroll layer, so the pane
 * contributes ZERO height to the row: the LIST pane sizes the palette and the
 * detail fills that height + scrolls. That's what keeps showing/hiding it from
 * resizing the modal — without which a tall detail grows the centered modal,
 * shifts the row under the cursor, and ping-pongs the hover (the detail
 * appearing/disappearing loop). Self-contained: drop it straight into
 * `Command.Body`, no second `Modal.Workspace` needed.
 */
function CommandDetail({ className, ...props }) {
    const { activeId, activeDetail } = useCommand();
    if (!activeId || activeDetail == null)
        return null;
    // Rendered as the shared Modal.Workspace surface (a frosted pane, matching the
    // list) — so the two-pane layout stays on-design — with the content in an
    // absolute scroll layer so the pane contributes ZERO height: the LIST sizes the
    // palette, this never does (no hover taper/loop). Drop it straight into
    // `Command.Body`; it self-wraps and removes itself for items without a detail.
    return (<index_ts_5.Modal.Workspace padded={false} className={(0, cx_ts_1.cx)('q-command-detail', className)} {...props}>
      <div className="q-command-detail-scroll">{activeDetail}</div>
    </index_ts_5.Modal.Workspace>);
}
/** Bottom bar — e.g. brand on the left, an Enter-to-confirm action on the right. */
function CommandFooter({ caption, actions, full: _full, children, className, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-command-footer', className)} {...props}>
      {children ?? (<>
          {caption != null ? <span className="q-command-footer-caption">{caption}</span> : <span aria-hidden/>}
          {actions != null ? <span className="q-command-footer-actions">{actions}</span> : null}
        </>)}
    </div>);
}
/**
 * Footer confirm button. Shows the active item's `action` label (falling back to
 * `fallback`) followed by `children` (typically a `<Kbd>`), and runs the active
 * item on click — the click equivalent of pressing Enter.
 */
function CommandAction({ fallback, className, children, ...props }) {
    const { activeId, select, activeAction } = useCommand();
    const label = activeAction ?? fallback;
    return (<button type="button" className={(0, cx_ts_1.cx)('q-command-action', className)} onClick={() => { if (activeId)
        select(activeId); }} disabled={!activeId} {...props}>
      {label != null ? <span className="q-command-action-label">{label}</span> : null}
      {children}
    </button>);
}
/* ── Dialog shell (⌘K palette) ─────────────────────────────────────────────── */
function matchShortcut(e, shortcut) {
    const parts = shortcut.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const needMod = parts.includes('mod') || parts.includes('cmd') || parts.includes('ctrl') || parts.includes('meta');
    const mod = e.metaKey || e.ctrlKey;
    return e.key.toLowerCase() === key && (needMod ? mod : true);
}
function splitDialogChildren(children) {
    const header = [];
    const body = [];
    let footer = null;
    for (const child of react_1.Children.toArray(children)) {
        if ((0, react_1.isValidElement)(child) && child.type === CommandInput) {
            header.push(child);
        }
        else if ((0, react_1.isValidElement)(child) && child.type === CommandFooter) {
            const props = child.props;
            footer = {
                actions: props.actions ?? props.children,
                caption: props.caption,
                children: props.actions == null ? undefined : props.children,
                full: props.full,
            };
        }
        else {
            body.push(child);
        }
    }
    return { body, footer, header };
}
/** The command palette in the shared Modal shell with an optional hotkey. */
function CommandDialog({ open, defaultOpen = false, onOpenChange, shortcut, size = 'md', label = 'Command menu', className, backdropClassName, container, initialFocus = true, finalFocus, children, ...commandProps }) {
    const [uncontrolled, setUncontrolled] = (0, react_1.useState)(defaultOpen);
    const isOpen = open ?? uncontrolled;
    const setOpen = (0, react_1.useCallback)((next) => {
        if (open === undefined)
            setUncontrolled(next);
        onOpenChange?.(next);
    }, [open, onOpenChange]);
    (0, react_1.useEffect)(() => {
        if (!shortcut)
            return;
        const onKey = (e) => {
            if (matchShortcut(e, shortcut)) {
                e.preventDefault();
                setOpen(!isOpen);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [shortcut, isOpen, setOpen]);
    const { body, footer, header } = splitDialogChildren(children);
    return (<CommandRoot label={label} className="q-command-dialog-context" {...commandProps}>
      <index_ts_5.Modal.Root open={isOpen} onOpenChange={setOpen}>
        <index_ts_5.Modal.Content aria-label={label} size={size} className={className} backdropClassName={backdropClassName} container={container} initialFocus={initialFocus} finalFocus={finalFocus}>
          <index_ts_5.Modal.Header>
            {header.length > 0 ? header : <CommandInput />}
            <index_ts_5.Modal.CloseButton />
          </index_ts_5.Modal.Header>
          <index_ts_5.Modal.Body padded={false}>
            {body}
          </index_ts_5.Modal.Body>
          {footer != null
            ? (<index_ts_5.Modal.Footer full={footer.full}>
                  {footer.children ?? (<>
                      {footer.caption != null ? <index_ts_5.Modal.FooterCaption>{footer.caption}</index_ts_5.Modal.FooterCaption> : <index_ts_5.Modal.Spacer />}
                      {footer.actions != null ? <index_ts_5.Modal.FooterActions full={footer.full}>{footer.actions}</index_ts_5.Modal.FooterActions> : null}
                    </>)}
                </index_ts_5.Modal.Footer>)
            : null}
        </index_ts_5.Modal.Content>
      </index_ts_5.Modal.Root>
    </CommandRoot>);
}
/* `Command` is both the inline root and the namespace holding the parts. */
exports.Command = Object.assign(CommandRoot, {
    Root: CommandRoot,
    Dialog: CommandDialog,
    Input: CommandInput,
    List: CommandList,
    Empty: CommandEmpty,
    Loading: CommandLoading,
    Group: CommandGroup,
    Item: CommandItem,
    ItemIcon: CommandItemIcon,
    ItemContent: CommandItemContent,
    ItemTitle: CommandItemTitle,
    ItemDescription: CommandItemDescription,
    ItemTrailing: CommandItemTrailing,
    Separator: CommandSeparator,
    Shortcut: CommandShortcut,
    Body: CommandBody,
    Detail: CommandDetail,
    Footer: CommandFooter,
    Action: CommandAction,
});
//# sourceMappingURL=cmdk.js.map