/**
 * Process-local fallback when Turso is not configured.
 * Fine for local `npm start`; cold starts on Vercel wipe it.
 */

const g = globalThis;

function bag(key, init) {
  if (!g.__one8bStore) g.__one8bStore = {};
  if (!g.__one8bStore[key]) g.__one8bStore[key] = init();
  return g.__one8bStore[key];
}

export function memKeep() {
  return bag("keep", () => ({
    byEmail: new Map(),
    byTok: new Map(),
    devices: new Map(), // tok -> Map(dv -> {ml, last_at})
    carry: new Map(),
  }));
}

export function memLives() {
  return bag("lives", () => ({
    state: new Map(), // tok -> {on, updated_at}
    blobs: new Map(), // `${tok}:${dv}` -> row
  }));
}

export function memMove() {
  return bag("move", () => new Map());
}

export function memHomes() {
  return bag("homes", () => ({
    byTok: new Map(),
    byHk: new Map(),
    rooms: new Map(), // mem_id -> row
  }));
}

export function memPostsExtra() {
  return bag("postsExtra", () => ({
    toks: new Map(), // id -> tok
    hidden: new Set(),
    reports: new Map(),
    rem: new Map(),
  }));
}

export function memStats() {
  return bag("memStats", () => new Map()); // id -> {candles, act, last_word, last_at, hidden}
}

export function memMemorials() {
  return bag("memorials", () => ({
    byId: new Map(),
    byTok: new Map(), // tok -> [id]
  }));
}
