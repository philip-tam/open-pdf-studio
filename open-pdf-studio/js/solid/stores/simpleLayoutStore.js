import { createSignal } from 'solid-js';
import { setCollapsed as setLeftPanelCollapsed } from './leftPanelStore.js';
import { setPanelVisible as setPropertiesPanelVisible } from './propertiesStore.js';

// Session-only (never persisted to preferences): every desktop launch starts
// in this compact layout — ribbon minimized, left panel and properties
// panel collapsed — so the page gets the space instead of the full editing
// chrome. Set once in main.js's init(). Any panel here can still be
// reopened normally (clicking a left-panel tab, selecting an annotation,
// the ribbon's own expand button) — this only sets the starting point, and
// never comes back on its own once you've expanded something.
const [simpleLayout, setSimpleLayout] = createSignal(false);

export function enterSimpleLayout() {
  setSimpleLayout(true);
  setLeftPanelCollapsed(true);
  setPropertiesPanelVisible(false);
}

export { simpleLayout, setSimpleLayout };
