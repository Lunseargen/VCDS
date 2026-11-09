// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyTheme, loadTheme, saveTheme, THEME_STORAGE_KEY } from '../src/theme';

const store = (value: string | null) => ({ getItem: () => value });

describe('theme', () => {
  it('gives light by default and for bad values, and dark only for "dark"', () => {
    expect(loadTheme(undefined)).toBe('light');
    expect(loadTheme(store(null))).toBe('light');
    expect(loadTheme(store('blue'))).toBe('light');
    expect(loadTheme(store('dark'))).toBe('dark');
    expect(
      loadTheme({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe('light');
  });
  it('saves the theme and reports a failed save', () => {
    const map = new Map<string, string>();
    expect(saveTheme({ setItem: (k, v) => void map.set(k, v) }, 'dark')).toBe(true);
    expect(map.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(saveTheme(undefined, 'dark')).toBe(false);
    expect(
      saveTheme(
        {
          setItem: () => {
            throw new Error('full');
          },
        },
        'light',
      ),
    ).toBe(false);
  });
  it('sets data-theme on the root element', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    const el = document.createElement('div');
    applyTheme('light', el);
    expect(el.dataset.theme).toBe('light');
  });
});
