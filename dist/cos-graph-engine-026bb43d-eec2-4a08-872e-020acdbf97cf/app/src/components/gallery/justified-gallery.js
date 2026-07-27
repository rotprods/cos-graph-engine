"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JustifiedGallery = JustifiedGallery;
const react_1 = require("react");
const loader_1 = require("@higgsfield/quanta/loader");
const typography_1 = require("@higgsfield/quanta/typography");
const gallery_tile_tsx_1 = require("./gallery-tile.tsx");
const density_control_tsx_1 = require("./density-control.tsx");
const use_justified_gallery_ts_1 = require("./use-justified-gallery.ts");
const use_reduced_motion_ts_1 = require("./use-reduced-motion.ts");
const demo_data_ts_1 = require("./demo-data.ts");
require("./gallery.css");
const numberFormat = new Intl.NumberFormat('en-US');
function JustifiedGallery({ items }) {
    const initial = (0, react_1.useMemo)(() => items ?? (0, demo_data_ts_1.makeInitialItems)(), [items]);
    const reducedMotion = (0, use_reduced_motion_ts_1.useReducedMotion)();
    const { viewportRef, layout, visibleRows, scrollTop, viewportHeight, fastScroll, density, setDensity, itemCount, loadingMore, } = (0, use_justified_gallery_ts_1.useJustifiedGallery)(initial);
    const viewTop = scrollTop;
    const viewBottom = scrollTop + viewportHeight;
    return (<div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 items-center justify-between gap-4 px-0.5">
        <div className="flex items-center gap-2">
          <typography_1.Typography as="h2" variant="body-sm-semi-bold" color="primary">
            Your generations
          </typography_1.Typography>
          <typography_1.Typography as="span" variant="caption-sm-regular" color="tertiary">
            {numberFormat.format(itemCount)}
            {' items'}
          </typography_1.Typography>
          {loadingMore && (<span className="flex items-center gap-1.5 text-q-text-tertiary">
              <loader_1.Loader variant="circle" size="xs" color="neutral" aria-label="Loading more"/>
              <typography_1.Typography as="span" variant="caption-sm-regular" color="tertiary">
                Loading
              </typography_1.Typography>
            </span>)}
        </div>
        <density_control_tsx_1.DensityControl value={density} onChange={setDensity}/>
      </header>

      <div ref={viewportRef} className="qg-viewport relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full" style={{ height: layout.totalHeight }}>
          {visibleRows.map((row) => {
            if (row.type === 'header') {
                return (<div key={row.key} className="absolute inset-x-0 flex items-end px-0.5 pb-2" style={{ top: row.y, height: row.height }}>
                  <typography_1.Typography as="h3" variant="caption-sm-medium" color="tertiary">
                    {row.label}
                  </typography_1.Typography>
                </div>);
            }
            const rowVisible = row.y < viewBottom && row.y + row.height > viewTop;
            const tier = rowVisible ? 'full' : 'near';
            return row.tiles.map(rect => (<gallery_tile_tsx_1.GalleryTile key={rect.item.id} item={rect.item} rect={rect} top={row.y} tier={tier} fastScroll={fastScroll} reducedMotion={reducedMotion}/>));
        })}
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=justified-gallery.js.map