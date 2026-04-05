// src/utils/reviewCache.js
// In-memory cache for review data (avg ratings, review counts, recent reviews)
// Avoids hitting the database on every notification or stats request.

class ReviewCache {
  constructor(ttl = 120_000, maxEntries = 500) {
    this._cache = new Map();
    this._ttl = ttl;         // default 2 min
    this._maxEntries = maxEntries;
  }

  /** Build a composite key */
  _key(prefix, id) {
    return `${prefix}:${id}`;
  }

  /** Get cached value or null */
  get(prefix, id) {
    const key = this._key(prefix, id);
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this._ttl) {
      this._cache.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Store a value */
  set(prefix, id, value) {
    // Evict oldest if at capacity
    if (this._cache.size >= this._maxEntries) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
    this._cache.set(this._key(prefix, id), { value, ts: Date.now() });
  }

  /** Invalidate a specific entry */
  invalidate(prefix, id) {
    this._cache.delete(this._key(prefix, id));
  }

  /** Invalidate all entries for a given prefix */
  invalidatePrefix(prefix) {
    for (const key of this._cache.keys()) {
      if (key.startsWith(`${prefix}:`)) {
        this._cache.delete(key);
      }
    }
  }

  /** Clear everything */
  clear() {
    this._cache.clear();
  }

  /** Cache size (for monitoring) */
  get size() {
    return this._cache.size;
  }
}

// Singleton — shared across the app
const reviewCache = new ReviewCache();

module.exports = { reviewCache };
