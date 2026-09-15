// Reader Mode: per-PDF "where was I" memory — page, scroll position, and
// zoom — saved on close and restored on the next open of that same file,
// gated entirely by state.preferences.readerMode. This is NOT a session
// restore (which files were open, see main.js's restoreLastSession) and
// NOT a different rendering path — bookmarks/highlights/annotations are
// completely untouched; it only remembers a reading position per file path
// (the FULL path, so two same-named files in different folders never
// collide).
//
// Persisted to a Rust-backed file (reader_positions.json in the app data
// dir, same mechanism as preferences.json/session.json — survives WebView2
// data clears, unlike localStorage), with localStorage as the load/save
// fallback outside Tauri. Loaded once into an in-memory cache at startup
// (initReaderMode(), called from main.js); the save/get/clear functions
// below are synchronous reads/writes against that cache so call sites in
// tabs.js/loader.js don't need to await file I/O on every open/close.
import { isTauri, saveReaderPositionsFile, loadReaderPositionsFile } from './platform.js';

const LOCAL_STORAGE_KEY = 'readerModePositions';
const MAX_ENTRIES = 200;

let cache = null;
let loadPromise = null;

async function ensureLoaded() {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      let loaded = null;
      if (isTauri()) {
        try {
          loaded = await loadReaderPositionsFile();
        } catch (e) {
          console.warn('Failed to load reader-mode positions file:', e);
        }
      }
      if (!loaded) {
        try {
          const s = localStorage.getItem(LOCAL_STORAGE_KEY);
          loaded = s ? JSON.parse(s) : null;
        } catch (e) {
          console.warn('Failed to read reader-mode positions:', e);
        }
      }
      cache = loaded || {};
      return cache;
    })();
  }
  return loadPromise;
}

function persist() {
  if (!cache) return;
  if (isTauri()) {
    saveReaderPositionsFile(cache).catch((e) =>
      console.warn('Failed to save reader-mode positions file:', e)
    );
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save reader-mode positions:', e);
  }
}

/**
 * Load the on-disk positions into the in-memory cache. Call once at app
 * startup (fire-and-forget is fine — nothing reads the cache until a PDF is
 * opened or closed, which is always later than this resolves in practice).
 */
export async function initReaderMode() {
  await ensureLoaded();
}

/**
 * Save the reading position for a file. No-op if `filePath` is falsy or the
 * cache hasn't loaded yet (startup-race edge case — extremely unlikely to
 * matter in practice, since closing a file always happens well after init).
 * @param {string} filePath
 * @param {{page: number, scale: number, scrollTop: number, scrollHeight: number, viewMode: string}} position
 */
export function saveReaderPosition(filePath, position) {
  if (!filePath || !cache) return;
  cache[filePath] = { ...position, savedAt: Date.now() };

  const paths = Object.keys(cache);
  if (paths.length > MAX_ENTRIES) {
    // Evict the least-recently-saved entries first.
    paths
      .sort((a, b) => (cache[a].savedAt || 0) - (cache[b].savedAt || 0))
      .slice(0, paths.length - MAX_ENTRIES)
      .forEach((p) => delete cache[p]);
  }

  persist();
}

/**
 * @param {string} filePath
 * @returns {{page: number, scale: number, scrollTop: number, scrollHeight: number, viewMode: string} | null}
 */
export function getReaderPosition(filePath) {
  if (!filePath || !cache) return null;
  return cache[filePath] || null;
}

/**
 * Forget the saved position for one file (e.g. if the user wants a fresh
 * start on their next open of it).
 * @param {string} filePath
 */
export function clearReaderPosition(filePath) {
  if (!filePath || !cache || !cache[filePath]) return;
  delete cache[filePath];
  persist();
}

/**
 * Forget every saved reading position — offered when the user turns Reader
 * Mode off, in case they don't want the accumulated positions left behind.
 */
export function clearAllReaderPositions() {
  cache = {};
  persist();
}
