// src/utils/cache.js
class Cache {
  constructor(ttl = 60000) { // Default 60 seconds
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key, data) {
    if (this.cache.size > 1000) { // Limit cache size
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, ts: Date.now() });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = Cache;
