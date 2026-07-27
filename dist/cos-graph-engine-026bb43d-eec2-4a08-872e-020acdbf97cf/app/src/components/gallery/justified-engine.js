"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JustifiedLayoutEngine = void 0;
const DEFAULT_CONFIG = {
    containerWidth: 0,
    targetRowHeight: 200,
    gap: 6,
    headerHeight: 44,
    groupGap: 20,
    maxRowHeight: 460,
};
class JustifiedLayoutEngine {
    items = [];
    groups = [];
    config = { ...DEFAULT_CONFIG };
    layout = { rows: [], totalHeight: 0, itemCount: 0 };
    /** Per-item resolved geometry, indexed by item index — powers scroll anchoring. */
    itemTops = [];
    itemHeights = [];
    dirty = true;
    setItems(items) {
        this.items = items;
        this.recomputeGroups();
        this.dirty = true;
    }
    /** Returns true if any geometry field actually changed. */
    setConfig(patch) {
        let changed = false;
        for (const key of Object.keys(patch)) {
            const next = patch[key];
            if (next != null && next !== this.config[key]) {
                this.config[key] = next;
                changed = true;
            }
        }
        if (changed)
            this.dirty = true;
        return changed;
    }
    getConfig() {
        return this.config;
    }
    recomputeGroups() {
        const groups = [];
        let current = null;
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (current == null || current.id !== item.groupId) {
                if (current != null)
                    current.end = i;
                current = { id: item.groupId, label: item.groupLabel, start: i, end: i + 1 };
                groups.push(current);
            }
        }
        if (current != null)
            current.end = this.items.length;
        this.groups = groups;
    }
    /** Compute (or return cached) layout for the current items + config. */
    compute() {
        if (!this.dirty)
            return this.layout;
        const { containerWidth, targetRowHeight, gap, headerHeight, groupGap, maxRowHeight } = this.config;
        const rows = [];
        const itemTops = new Array(this.items.length).fill(0);
        const itemHeights = new Array(this.items.length).fill(0);
        if (containerWidth <= 0) {
            this.layout = { rows: [], totalHeight: 0, itemCount: this.items.length };
            this.itemTops = itemTops;
            this.itemHeights = itemHeights;
            this.dirty = false;
            return this.layout;
        }
        let y = 0;
        let rowKey = 0;
        for (const group of this.groups) {
            // Group header band.
            rows.push({
                type: 'header',
                y,
                height: headerHeight,
                key: `h-${group.id}`,
                label: group.label,
            });
            y += headerHeight;
            // Greedily pack this group's items into justified rows.
            let rowStart = group.start;
            let aspectSum = 0;
            const flushRow = (endExclusive, isLastRowOfGroup) => {
                const n = endExclusive - rowStart;
                if (n <= 0)
                    return;
                const totalGap = gap * (n - 1);
                // The height that makes the row exactly fill the width.
                let rowHeight = (containerWidth - totalGap) / aspectSum;
                // The final partial row of a group is never stretched past the target.
                if (isLastRowOfGroup && rowHeight > targetRowHeight)
                    rowHeight = targetRowHeight;
                // Guard against a run of panoramas producing a razor-thin row, or a
                // single portrait producing a skyscraper.
                rowHeight = Math.min(rowHeight, maxRowHeight);
                const tiles = [];
                let x = 0;
                for (let i = rowStart; i < endExclusive; i++) {
                    const item = this.items[i];
                    const aspect = item.width / item.height;
                    const w = rowHeight * aspect;
                    tiles.push({ index: i, item, x, width: w, height: rowHeight });
                    itemTops[i] = y;
                    itemHeights[i] = rowHeight;
                    x += w + gap;
                }
                rows.push({ type: 'tiles', y, height: rowHeight, key: `r-${rowKey++}`, tiles });
                y += rowHeight + gap;
            };
            for (let i = group.start; i < group.end; i++) {
                const item = this.items[i];
                const aspect = item.width / item.height;
                aspectSum += aspect;
                // Natural width of the row so far at the target height.
                const naturalWidth = targetRowHeight * aspectSum + gap * (i - rowStart);
                if (naturalWidth >= containerWidth) {
                    flushRow(i + 1, false);
                    rowStart = i + 1;
                    aspectSum = 0;
                }
            }
            // Trailing partial row.
            if (rowStart < group.end)
                flushRow(group.end, true);
            // Remove the trailing inter-row gap, add the group gap instead.
            y = y - gap + groupGap;
        }
        const totalHeight = Math.max(0, y - groupGap);
        this.layout = { rows, totalHeight, itemCount: this.items.length };
        this.itemTops = itemTops;
        this.itemHeights = itemHeights;
        this.dirty = false;
        return this.layout;
    }
    getLayout() {
        return this.compute();
    }
    /**
     * The visible window: the [startRow, endRow) slice of rows intersecting the
     * viewport expanded by `overscanPx` on each edge. Binary-searches the rows
     * (which are sorted by `y`) so cost is O(log n), independent of dataset size.
     */
    getWindow(scrollTop, viewportHeight, overscanPx) {
        const { rows } = this.compute();
        if (rows.length === 0)
            return { startRow: 0, endRow: 0 };
        const top = scrollTop - overscanPx;
        const bottom = scrollTop + viewportHeight + overscanPx;
        // First row whose bottom edge is past `top`.
        let lo = 0;
        let hi = rows.length - 1;
        let startRow = rows.length;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const row = rows[mid];
            if (row.y + row.height >= top) {
                startRow = mid;
                hi = mid - 1;
            }
            else {
                lo = mid + 1;
            }
        }
        // First row whose top edge is at/after `bottom` → the exclusive end.
        lo = 0;
        hi = rows.length - 1;
        let endRow = rows.length;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const row = rows[mid];
            if (row.y > bottom) {
                endRow = mid;
                hi = mid - 1;
            }
            else {
                lo = mid + 1;
            }
        }
        return { startRow: Math.min(startRow, rows.length), endRow };
    }
    /** Top offset of an item — used to re-pin the scroll after a re-layout. */
    getItemTop(index) {
        this.compute();
        return this.itemTops[index] ?? 0;
    }
    getItemHeight(index) {
        this.compute();
        return this.itemHeights[index] ?? 0;
    }
    /**
     * The topmost item at least partially visible at `scrollTop`, plus the pixel
     * offset between the viewport top and that item's top. The React layer stores
     * this before a density/resize re-layout and restores it afterwards so the
     * content under the user's eyes stays put (scroll anchoring).
     */
    findAnchor(scrollTop) {
        this.compute();
        if (this.items.length === 0)
            return { index: 0, offset: 0 };
        // Binary search itemTops for the last item whose top is <= scrollTop.
        let lo = 0;
        let hi = this.itemTops.length - 1;
        let index = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (this.itemTops[mid] <= scrollTop) {
                index = mid;
                lo = mid + 1;
            }
            else {
                hi = mid - 1;
            }
        }
        return { index, offset: scrollTop - (this.itemTops[index] ?? 0) };
    }
}
exports.JustifiedLayoutEngine = JustifiedLayoutEngine;
//# sourceMappingURL=justified-engine.js.map