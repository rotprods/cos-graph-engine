"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const react_2 = require("react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
const FRUITS = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Mango', 'Orange'];
function Basic(props = {}) {
    return (<index_ts_1.Autocomplete.Root items={FRUITS} openOnInputClick {...props}>
      <index_ts_1.Autocomplete.Input placeholder="Search fruits"/>
      <index_ts_1.Autocomplete.Content>
        <index_ts_1.Autocomplete.Empty>No fruits found.</index_ts_1.Autocomplete.Empty>
        <index_ts_1.Autocomplete.List>
          {(item) => (<index_ts_1.Autocomplete.Item key={item} value={item}>{item}</index_ts_1.Autocomplete.Item>)}
        </index_ts_1.Autocomplete.List>
      </index_ts_1.Autocomplete.Content>
    </index_ts_1.Autocomplete.Root>);
}
(0, vitest_1.describe)('Autocomplete', () => {
    (0, vitest_1.it)('renders the input on the canonical field surface with a search affix', () => {
        (0, react_1.render)(<Basic />);
        const input = react_1.screen.getByPlaceholderText('Search fruits');
        (0, vitest_1.expect)(input).toHaveClass('q-field-input');
        (0, vitest_1.expect)(input.closest('.q-field-control')).toHaveClass('q-autocomplete-control');
    });
    (0, vitest_1.it)('exposes the input as a combobox', () => {
        (0, react_1.render)(<Basic />);
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).toBe(react_1.screen.getByPlaceholderText('Search fruits'));
    });
    (0, vitest_1.it)('filters the list as the user types (Base UI matching)', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        const input = react_1.screen.getByRole('combobox');
        await user.click(input);
        await user.type(input, 'ap');
        // Substring match against the items prop: Apple, Apricot, Grape.
        await (0, react_1.waitFor)(() => (0, vitest_1.expect)(react_1.screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument());
        (0, vitest_1.expect)(react_1.screen.getByRole('option', { name: 'Apricot' })).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('option', { name: 'Grape' })).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByRole('option', { name: 'Banana' })).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('renders the empty state when nothing matches', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        const input = react_1.screen.getByRole('combobox');
        await user.click(input);
        await user.type(input, 'zzz');
        (0, vitest_1.expect)(await react_1.screen.findByText('No fruits found.')).toBeInTheDocument();
    });
    (0, vitest_1.it)('fires onValueChange as the input changes', async () => {
        const user = user_event_1.default.setup();
        const onValueChange = vitest_1.vi.fn();
        (0, react_1.render)(<Basic onValueChange={onValueChange}/>);
        await user.type(react_1.screen.getByRole('combobox'), 'man');
        (0, vitest_1.expect)(onValueChange).toHaveBeenCalled();
        (0, vitest_1.expect)(onValueChange.mock.calls.at(-1)?.[0]).toBe('man');
    });
    (0, vitest_1.it)('clears the value via the Clear button', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        const input = react_1.screen.getByRole('combobox');
        await user.type(input, 'Banana');
        (0, vitest_1.expect)(input.value).toBe('Banana');
        const clearBtn = document.querySelector('.q-autocomplete-clear');
        (0, vitest_1.expect)(clearBtn).not.toBeNull();
        await user.click(clearBtn);
        (0, vitest_1.expect)(input.value).toBe('');
    });
    (0, vitest_1.it)('paints popup + rows with the shared glass / menu utilities', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        await user.click(react_1.screen.getByRole('combobox'));
        const option = await react_1.screen.findByRole('option', { name: 'Apple' });
        (0, vitest_1.expect)(option).toHaveClass('q-menu-item');
        (0, vitest_1.expect)(option.closest('.q-dropdown-content')).toHaveClass('q-autocomplete-content');
    });
    (0, vitest_1.it)('composes rich item rows from the shared parts', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.Autocomplete.Root items={FRUITS} openOnInputClick>
        <index_ts_1.Autocomplete.Input placeholder="Search"/>
        <index_ts_1.Autocomplete.Content>
          <index_ts_1.Autocomplete.List>
            {(item) => (<index_ts_1.Autocomplete.Item key={item} value={item}>
                <index_ts_1.Autocomplete.ItemContent>
                  <index_ts_1.Autocomplete.ItemTitleRow>
                    <index_ts_1.Autocomplete.ItemTitle>{item}</index_ts_1.Autocomplete.ItemTitle>
                  </index_ts_1.Autocomplete.ItemTitleRow>
                  <index_ts_1.Autocomplete.ItemDescription>A fruit</index_ts_1.Autocomplete.ItemDescription>
                </index_ts_1.Autocomplete.ItemContent>
              </index_ts_1.Autocomplete.Item>)}
          </index_ts_1.Autocomplete.List>
        </index_ts_1.Autocomplete.Content>
      </index_ts_1.Autocomplete.Root>);
        await user.click(react_1.screen.getByRole('combobox'));
        const title = await react_1.screen.findByText('Apple');
        (0, vitest_1.expect)(title).toHaveClass('q-menu-item-title');
        (0, vitest_1.expect)(react_1.screen.getAllByText('A fruit')[0]).toHaveClass('q-menu-item-description');
    });
    (0, vitest_1.it)('selects an item on click and fills the input', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        const input = react_1.screen.getByRole('combobox');
        await user.click(input);
        await user.click(await react_1.screen.findByRole('option', { name: 'Cherry' }));
        (0, vitest_1.expect)(input.value).toBe('Cherry');
    });
    (0, vitest_1.it)('forwards a ref to the underlying input element', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Autocomplete.Root items={FRUITS}>
        <index_ts_1.Autocomplete.Input ref={ref} placeholder="Search"/>
        <index_ts_1.Autocomplete.Content>
          <index_ts_1.Autocomplete.List>
            {(item) => <index_ts_1.Autocomplete.Item key={item} value={item}>{item}</index_ts_1.Autocomplete.Item>}
          </index_ts_1.Autocomplete.List>
        </index_ts_1.Autocomplete.Content>
      </index_ts_1.Autocomplete.Root>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(HTMLInputElement);
        (0, vitest_1.expect)(ref.current).toBe(react_1.screen.getByPlaceholderText('Search'));
    });
    (0, vitest_1.it)('omits the clear button when clear is false', () => {
        (0, react_1.render)(<index_ts_1.Autocomplete.Root items={FRUITS}>
        <index_ts_1.Autocomplete.Input placeholder="Search" clear={false}/>
        <index_ts_1.Autocomplete.Content>
          <index_ts_1.Autocomplete.List>
            {(item) => <index_ts_1.Autocomplete.Item key={item} value={item}>{item}</index_ts_1.Autocomplete.Item>}
          </index_ts_1.Autocomplete.List>
        </index_ts_1.Autocomplete.Content>
      </index_ts_1.Autocomplete.Root>);
        (0, vitest_1.expect)(document.querySelector('.q-autocomplete-clear')).toBeNull();
    });
});
//# sourceMappingURL=autocomplete.test.js.map