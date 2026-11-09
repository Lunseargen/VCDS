// The colour theme of the dashboard. Light is the default (Jack, 2026-11-09).
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vcds.shuffleboard.theme';

/** Read the saved theme. A missing, bad, or blocked value gives 'light'. */
export function loadTheme(storage: Pick<Storage, 'getItem'> | undefined): Theme {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(storage: Pick<Storage, 'setItem'> | undefined, theme: Theme): boolean {
  try {
    if (!storage) return false;
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** Set `data-theme` on the root element. The CSS variables in styles.css follow it. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
