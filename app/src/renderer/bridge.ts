// Typed access to the desktop shell (Electron preload). Falls back to browser storage
// so the UI can also be opened in a plain browser during development.

import type { AppData } from '../core/types';
import type { Bridge } from './bridgeTypes';

export type { Bridge, HealthKitAccess, ImportResult } from './bridgeTypes';

const KEY = 'beheart-data';

const browserFallback: Bridge = {
  async load() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as AppData) : null;
  },
  async save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  },
  async dataLocation() {
    return 'browser storage';
  },
  async exportData() {
    return null;
  },
  async importAppleHealth() {
    throw new Error('Importing needs the desktop app.');
  },
  async searchFood(query) {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`,
    );
    const json = await res.json();
    return json.products ?? [];
  },
  async lookupBarcode(code) {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const json = await res.json();
    return json.status === 1 ? json.product : null;
  },
  async isScreenshot() {
    return false;
  },
  async startOptions() {
    return { screen: null, premium: false };
  },
};

export const bridge: Bridge = ((globalThis as any).beheart as Bridge | undefined) ?? browserFallback;
