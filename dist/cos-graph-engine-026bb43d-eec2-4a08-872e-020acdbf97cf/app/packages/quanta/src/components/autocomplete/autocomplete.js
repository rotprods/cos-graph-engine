"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Autocomplete = exports.AutocompleteCollection = void 0;
exports.AutocompleteRoot = AutocompleteRoot;
exports.AutocompleteInput = AutocompleteInput;
exports.AutocompleteContent = AutocompleteContent;
exports.AutocompleteList = AutocompleteList;
exports.AutocompleteItem = AutocompleteItem;
exports.AutocompleteGroup = AutocompleteGroup;
exports.AutocompleteGroupLabel = AutocompleteGroupLabel;
exports.AutocompleteEmpty = AutocompleteEmpty;
exports.AutocompleteClear = AutocompleteClear;
exports.AutocompleteItemIcon = AutocompleteItemIcon;
exports.AutocompleteItemContent = AutocompleteItemContent;
exports.AutocompleteItemTitleRow = AutocompleteItemTitleRow;
exports.AutocompleteItemTitle = AutocompleteItemTitle;
exports.AutocompleteItemDescription = AutocompleteItemDescription;
exports.AutocompleteItemTrailing = AutocompleteItemTrailing;
const react_1 = require("react");
const autocomplete_1 = require("@base-ui/react/autocomplete");
const IconCrossMediumOutlined_1 = require("@higgsfield-ai/icons/IconCrossMediumOutlined");
const IconMagnifyingGlass2Outlined_1 = require("@higgsfield-ai/icons/IconMagnifyingGlass2Outlined");
const index_ts_1 = require("../icon/index.ts");
const index_ts_2 = require("../not-found/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
/**
 * Autocomplete — a filter-as-you-type combobox on the Base UI `Autocomplete`
 * primitive (which owns filtering, roving highlight, keyboard nav, ARIA, the
 * portal + positioning, and all `data-*` state). Quanta only paints: the input
 * is the canonical quanta field surface (white-5%, radius 12, lime focus ring),
 * and the popup reuses the dropdown glass card + shared `q-menu-item*` rows (see
 * `autocomplete.css`, `dropdown.css`, `menu.css`).
 *
 * COMPOSITION-FIRST (same contract as Dropdown / Command). `Autocomplete.Item`
 * is a styled row that renders whatever children you give it — typically a bare
 * label, or the shared `q-menu-item*` parts (icon / label / description /
 * trailing) for richer rows. Base UI does the matching from the `items` prop on
 * `Root`; the `List` renders the filtered subset:
 *
 *   <Autocomplete.Root items={fruits}>
 *     <Autocomplete.Input placeholder="Search fruits…" />
 *     <Autocomplete.Content>
 *       <Autocomplete.Empty>No fruits found.</Autocomplete.Empty>
 *       <Autocomplete.List>
 *         {(item: string) => (
 *           <Autocomplete.Item key={item} value={item}>{item}</Autocomplete.Item>
 *         )}
 *       </Autocomplete.List>
 *     </Autocomplete.Content>
 *   </Autocomplete.Root>
 *
 * Pass `value` / `defaultValue` / `onValueChange` / `items` / `filter` /
 * `openOnInputClick` etc. straight through to `Autocomplete.Root` (Base UI).
 * `Autocomplete.Content` bundles the Portal + Positioner + Popup; drop the
 * `List`, `Group`, `GroupLabel`, `Item` and `Empty` inside it.
 */
/* ── Root ────────────────────────────────────────────────────────────────────
 * Passes everything through to Base UI (it owns the value/filter model).
 * `connected` flows Root → Input + Content so the popup attaches flush to the
 * field as one seamless surface (mirrors Select). */
/**
 * `connected` flows to Input + Content; `controlRef` points the Positioner at
 * the FIELD WRAPPER (not the inner Base UI input, which is narrower and inset by
 * the search/clear affixes) so the popup matches the full field width + edge.
 */
const AutocompleteUiContext = (0, react_1.createContext)({ connected: false, controlRef: { current: null } });
function AutocompleteRoot({ connected = false, ...props }) {
    const controlRef = (0, react_1.useRef)(null);
    return (<AutocompleteUiContext.Provider value={{ connected, controlRef }}>
      <autocomplete_1.Autocomplete.Root {...props}/>
    </AutocompleteUiContext.Provider>);
}
const DEFAULT_START = <index_ts_1.Icon size="md"><IconMagnifyingGlass2Outlined_1.IconMagnifyingGlass2Outlined /></index_ts_1.Icon>;
function AutocompleteInput({ className, controlClassName, start = DEFAULT_START, clear = true, clearLabel = 'Clear', ...props }) {
    const { connected, controlRef } = (0, react_1.useContext)(AutocompleteUiContext);
    return (<div ref={controlRef} className={(0, cx_ts_1.cx)('q-field-control', 'q-autocomplete-control', connected && 'q-autocomplete-control-connected', controlClassName)}>
      {start != null ? <span className="q-field-affix">{start}</span> : null}
      <autocomplete_1.Autocomplete.Input className={(0, cx_ts_1.cx)('q-field-input', className)} autoComplete="off" autoCorrect="off" spellCheck={false} {...props}/>
      {clear
            ? (<autocomplete_1.Autocomplete.Clear className="q-autocomplete-clear" aria-label={clearLabel} render={<button type="button"/>}>
              <index_ts_1.Icon size="sm"><IconCrossMediumOutlined_1.IconCrossMediumOutlined /></index_ts_1.Icon>
            </autocomplete_1.Autocomplete.Clear>)
            : null}
    </div>);
}
function AutocompleteContent({ className, solid = false, sideOffset, positionerClassName, container, children, ...props }) {
    const { connected, controlRef } = (0, react_1.useContext)(AutocompleteUiContext);
    // Connected = the popup NESTS the field (mirrors Select): a wider rounded card
    // that overlaps + sits BEHIND the input (the input keeps the higher z-index and
    // stays typable on top), centred, with top padding so the rows clear the input.
    // Pull it up over the 40px field. Base UI Combobox REQUIRES the Portal, so the
    // popup stays portaled and the input wins via z-index in the root stacking
    // context. The floating glass keeps its 6px gap.
    const resolvedSideOffset = sideOffset ?? (connected ? -48 : 6);
    return (<autocomplete_1.Autocomplete.Portal container={container}>
      <autocomplete_1.Autocomplete.Positioner anchor={controlRef} className={(0, cx_ts_1.cx)('q-autocomplete-positioner', connected && 'q-autocomplete-positioner-connected', positionerClassName)} align={connected ? 'center' : undefined} sideOffset={resolvedSideOffset}>
        <autocomplete_1.Autocomplete.Popup className={(0, cx_ts_1.cx)('q-dropdown-content', 'q-autocomplete-content', solid && 'q-dropdown-content-solid', connected && 'q-autocomplete-content-connected', className)} {...props}>
          {children}
        </autocomplete_1.Autocomplete.Popup>
      </autocomplete_1.Autocomplete.Positioner>
    </autocomplete_1.Autocomplete.Portal>);
}
function AutocompleteList({ className, ...props }) {
    return <autocomplete_1.Autocomplete.List className={(0, cx_ts_1.cx)('q-autocomplete-list', className)} {...props}/>;
}
function AutocompleteItem({ className, ...props }) {
    return <autocomplete_1.Autocomplete.Item className={(0, cx_ts_1.cx)('q-menu-item', className)} {...props}/>;
}
function AutocompleteGroup({ className, ...props }) {
    return <autocomplete_1.Autocomplete.Group className={(0, cx_ts_1.cx)('q-autocomplete-group', className)} {...props}/>;
}
function AutocompleteGroupLabel({ className, ...props }) {
    return <autocomplete_1.Autocomplete.GroupLabel className={(0, cx_ts_1.cx)('q-menu-group-label', className)} {...props}/>;
}
/** Renders the filtered items of a group (Base UI Collection). No DOM of its own. */
exports.AutocompleteCollection = autocomplete_1.Autocomplete.Collection;
function AutocompleteEmpty({ className, children, ...props }) {
    return (<autocomplete_1.Autocomplete.Empty className={(0, cx_ts_1.cx)('q-autocomplete-empty', className)} {...props}>
      {children ?? (<index_ts_2.NotFound size="sm" icon={<index_ts_1.Icon size="md"><IconMagnifyingGlass2Outlined_1.IconMagnifyingGlass2Outlined /></index_ts_1.Icon>} title="No results found" subtitle="Try a different search term"/>)}
    </autocomplete_1.Autocomplete.Empty>);
}
function AutocompleteClear({ className, children, ...props }) {
    return (<autocomplete_1.Autocomplete.Clear className={(0, cx_ts_1.cx)('q-autocomplete-clear', className)} render={<button type="button"/>} {...props}>
      {children ?? <index_ts_1.Icon size="sm"><IconCrossMediumOutlined_1.IconCrossMediumOutlined /></index_ts_1.Icon>}
    </autocomplete_1.Autocomplete.Clear>);
}
function AutocompleteItemIcon({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-icon', className)} {...props}/>;
}
function AutocompleteItemContent({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-label', className)} {...props}/>;
}
function AutocompleteItemTitleRow({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-title-row', className)} {...props}/>;
}
function AutocompleteItemTitle({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-title', className)} {...props}/>;
}
function AutocompleteItemDescription({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-description', className)} {...props}/>;
}
function AutocompleteItemTrailing({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-trailing', className)} {...props}/>;
}
/** `Autocomplete` namespace — the parts API. */
exports.Autocomplete = Object.assign(AutocompleteRoot, {
    Root: AutocompleteRoot,
    Input: AutocompleteInput,
    Content: AutocompleteContent,
    List: AutocompleteList,
    Item: AutocompleteItem,
    Group: AutocompleteGroup,
    GroupLabel: AutocompleteGroupLabel,
    Collection: exports.AutocompleteCollection,
    Empty: AutocompleteEmpty,
    Clear: AutocompleteClear,
    ItemIcon: AutocompleteItemIcon,
    ItemContent: AutocompleteItemContent,
    ItemTitleRow: AutocompleteItemTitleRow,
    ItemTitle: AutocompleteItemTitle,
    ItemDescription: AutocompleteItemDescription,
    ItemTrailing: AutocompleteItemTrailing,
});
//# sourceMappingURL=autocomplete.js.map