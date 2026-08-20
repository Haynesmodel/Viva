import './styles/app.css';

import { render } from 'preact';
import ThemeToggle from './components/theme/ThemeToggle';
import GlobalSearch from './components/search/GlobalSearch';
import DataFreshnessBadge, { createDataFreshnessRuntime } from './components/data-freshness/DataFreshnessBadge';
import { createVivaThemeRuntime, type VivaThemeRuntime } from './theme/apply-theme';
import { createSearchRuntime } from './search/search-runtime';
import type { VivaSearchRuntime } from './search/search-types';
import { createTableRuntime } from './tables/table-runtime';
import type { VivaTableRuntime } from './tables/table-types';
import type { DataDiagnostics } from './data/load-league-assets';
import { bootstrapVivaApp } from './app/app-controller';
import { bindDropdownChecklists } from './accessibility/dropdown-checklist';
import { focusableElements } from './accessibility/focus';
import { prefersReducedMotion, subscribeToReducedMotion } from './accessibility/motion';
import { bindPrimaryNavigation, syncPageState } from './accessibility/primary-navigation';
import { createAccessGate } from './access/access-gate';

type VivaDataLoader = typeof import('./data/load-league-assets').loadLeagueAssets;

interface BrowserWindow {
  vivaTheme?: VivaThemeRuntime;
  vivaSearch?: VivaSearchRuntime;
  vivaTables?: VivaTableRuntime;
  vivaDataLoader?: VivaDataLoader;
  vivaDataDiagnostics?: DataDiagnostics;
  vivaAccessibility?: {
    prefersReducedMotion: typeof prefersReducedMotion;
    focusableElements: typeof focusableElements;
    syncPageState: typeof syncPageState;
  };
}

interface BrowserDocument {
  readyState: string;
  getElementById(id: string): unknown;
  addEventListener(type: 'DOMContentLoaded', listener: () => void, options?: { once?: boolean }): void;
}

const themeRuntime = createVivaThemeRuntime();
const searchRuntime = createSearchRuntime();
const tableRuntime = createTableRuntime();
const freshnessRuntime = createDataFreshnessRuntime();
const browser = globalThis as unknown as {
  window: BrowserWindow;
  document?: BrowserDocument;
};

browser.window.vivaTheme = themeRuntime;
browser.window.vivaSearch = searchRuntime;
browser.window.vivaTables = tableRuntime;
browser.window.vivaDataLoader = async options => {
  const { loadLeagueAssets } = await import('./data/load-league-assets');
  return loadLeagueAssets(options);
};
browser.window.vivaAccessibility = {
  prefersReducedMotion,
  focusableElements,
  syncPageState,
};

function mountThemeControls() {
  const mount = browser.document!.getElementById('themeControls');
  render(<ThemeToggle runtime={themeRuntime} />, mount as Parameters<typeof render>[1]);
}

function mountGlobalSearch() {
  const mount = browser.document!.getElementById('globalSearchRoot');
  const portal = browser.document!.getElementById('globalSearchPortal');
  render(<GlobalSearch runtime={searchRuntime} portal={portal as any} />, mount as Parameters<typeof render>[1]);
}

function mountDataFreshness() {
  const mount = browser.document!.getElementById('dataFreshnessRoot');
  render(<DataFreshnessBadge runtime={freshnessRuntime} />, mount as Parameters<typeof render>[1]);
}

function mountShell() {
  mountThemeControls();
  mountGlobalSearch();
  mountDataFreshness();
  bindPrimaryNavigation(document);
  bindDropdownChecklists(document);
  subscribeToReducedMotion((reduced) => {
    document.documentElement.dataset.reducedMotion = reduced ? 'reduce' : 'no-preference';
    window.dispatchEvent(new CustomEvent('viva:motionchange', { detail: { reduced } }));
  });
  void bootstrapVivaApp({ tableRuntime, searchRuntime, freshnessRuntime });
}

const accessGate = createAccessGate({ onGranted: mountShell });

if (browser.document?.readyState === 'loading') {
  browser.document.addEventListener('DOMContentLoaded', accessGate.initialize, { once: true });
} else {
  accessGate.initialize();
}
