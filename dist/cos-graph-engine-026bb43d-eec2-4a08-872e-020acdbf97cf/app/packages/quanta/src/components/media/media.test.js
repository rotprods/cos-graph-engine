"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const react_2 = require("react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('Media.Root', () => {
    (0, vitest_1.it)('renders a box with the composite class and a default ratio/rounded', () => {
        (0, react_1.render)(<index_ts_1.Media data-testid="root">
        <index_ts_1.Media.Image src="/x.jpg" alt="x"/>
      </index_ts_1.Media>);
        const root = react_1.screen.getByTestId('root');
        (0, vitest_1.expect)(root).toHaveClass('q-media');
        // defaults: ratio="video" → aspect-video, rounded="md" → rounded-q-300
        (0, vitest_1.expect)(root).toHaveClass('aspect-video');
        (0, vitest_1.expect)(root).toHaveClass('rounded-q-300');
    });
    (0, vitest_1.it)('maps preset ratios + rounded tokens to their utilities', () => {
        (0, react_1.render)(<index_ts_1.Media data-testid="root" ratio="portrait" rounded="full"/>);
        const root = react_1.screen.getByTestId('root');
        (0, vitest_1.expect)(root).toHaveClass('q-media-portrait');
        (0, vitest_1.expect)(root).toHaveClass('rounded-q-full');
        (0, vitest_1.expect)(root).not.toHaveClass('aspect-video');
    });
    (0, vitest_1.it)('wires a numeric ratio through the --q-media-ratio var, not a class', () => {
        (0, react_1.render)(<index_ts_1.Media data-testid="root" ratio={4 / 3}/>);
        const root = react_1.screen.getByTestId('root');
        (0, vitest_1.expect)(root).not.toHaveClass('aspect-video');
        (0, vitest_1.expect)(root.style.getPropertyValue('--q-media-ratio')).toBe(String(4 / 3));
    });
    (0, vitest_1.it)('forwards ref to the root DOM node', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Media ref={ref}/>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(HTMLDivElement);
        (0, vitest_1.expect)(ref.current).toHaveClass('q-media');
    });
    (0, vitest_1.it)('keeps caller className last so callers win ordering', () => {
        (0, react_1.render)(<index_ts_1.Media data-testid="root" className="custom-x"/>);
        const cls = react_1.screen.getByTestId('root').className;
        (0, vitest_1.expect)(cls.trim().endsWith('custom-x')).toBe(true);
    });
});
(0, vitest_1.describe)('Media.Image / Media.Video', () => {
    (0, vitest_1.it)('renders an img filling the box with object-fit + lazy loading defaults', () => {
        (0, react_1.render)(<index_ts_1.Media.Image src="/photo.jpg" alt="A photo"/>);
        const img = react_1.screen.getByRole('img', { name: 'A photo' });
        (0, vitest_1.expect)(img).toHaveClass('q-media-fill');
        (0, vitest_1.expect)(img).toHaveClass('object-cover');
        (0, vitest_1.expect)(img).toHaveAttribute('loading', 'lazy');
    });
    (0, vitest_1.it)('honors the contain fit', () => {
        (0, react_1.render)(<index_ts_1.Media.Image src="/photo.jpg" alt="A photo" fit="contain"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('img', { name: 'A photo' })).toHaveClass('object-contain');
    });
    (0, vitest_1.it)('renders a video and passes poster/controls through', () => {
        (0, react_1.render)(<index_ts_1.Media.Video data-testid="vid" poster="/poster.jpg" controls muted/>);
        const vid = react_1.screen.getByTestId('vid');
        (0, vitest_1.expect)(vid.tagName).toBe('VIDEO');
        (0, vitest_1.expect)(vid).toHaveClass('q-media-fill');
        (0, vitest_1.expect)(vid).toHaveAttribute('poster', '/poster.jpg');
    });
    (0, vitest_1.it)('autoPlayInView forces muted + lazies preload (autoplay requirements)', () => {
        (0, react_1.render)(<index_ts_1.Media.Video data-testid="vid" src="/clip.mp4" autoPlayInView loop/>);
        const vid = react_1.screen.getByTestId('vid');
        (0, vitest_1.expect)(vid.muted).toBe(true);
        (0, vitest_1.expect)(vid).toHaveAttribute('preload', 'metadata');
        (0, vitest_1.expect)(vid).toHaveAttribute('loop');
    });
    (0, vitest_1.it)('leaves preload unset for a normal (non-autoplay) video', () => {
        (0, react_1.render)(<index_ts_1.Media.Video data-testid="vid" src="/clip.mp4"/>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('vid')).not.toHaveAttribute('preload');
    });
});
(0, vitest_1.describe)('Media.Overlay / Media.Fallback / Media.Caption', () => {
    (0, vitest_1.it)('places the overlay via the placement utility', () => {
        (0, react_1.render)(<index_ts_1.Media.Overlay data-testid="ov" placement="bottom">scrim</index_ts_1.Media.Overlay>);
        const ov = react_1.screen.getByTestId('ov');
        (0, vitest_1.expect)(ov).toHaveClass('q-media-overlay');
        (0, vitest_1.expect)(ov).toHaveClass('q-media-overlay-bottom');
    });
    (0, vitest_1.it)('renders fallback content', () => {
        (0, react_1.render)(<index_ts_1.Media.Fallback>No image</index_ts_1.Media.Fallback>);
        (0, vitest_1.expect)(react_1.screen.getByText('No image')).toHaveClass('q-media-fallback');
    });
    (0, vitest_1.it)('renders a caption', () => {
        (0, react_1.render)(<index_ts_1.Media.Caption>Sunset</index_ts_1.Media.Caption>);
        (0, vitest_1.expect)(react_1.screen.getByText('Sunset')).toHaveClass('q-media-caption');
    });
});
(0, vitest_1.describe)('useMediaFallback (broken-source flow)', () => {
    function BrokenImage() {
        const { failed, onError } = (0, index_ts_1.useMediaFallback)();
        return (<index_ts_1.Media>
        {failed
                ? <index_ts_1.Media.Fallback>Broken</index_ts_1.Media.Fallback>
                : <index_ts_1.Media.Image src="/missing.jpg" alt="thing" onError={onError}/>}
      </index_ts_1.Media>);
    }
    (0, vitest_1.it)('flips to the fallback when the image errors (mirrors Avatar onError)', () => {
        (0, react_1.render)(<BrokenImage />);
        const img = react_1.screen.getByRole('img', { name: 'thing' });
        (0, vitest_1.expect)(react_1.screen.queryByText('Broken')).toBeNull();
        react_1.fireEvent.error(img);
        (0, vitest_1.expect)(react_1.screen.getByText('Broken')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByRole('img', { name: 'thing' })).toBeNull();
    });
});
//# sourceMappingURL=media.test.js.map