/* cache.js
   Simple in-memory LRU cache with optional persistent backing via IndexedDB for recent events.
   Exposes get / set / has / prune.
*/

const DB_NAME = 'sinal-pro-cache';
const STORE = 'events';

export class Cache {
  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
    this.map = new Map(); // preserve insertion order for LRU
    this._initDB();
  }

  async _initDB() {
    if (!('indexedDB' in window)) return;
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => resolve();
    });
  }

  _touch(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxEntries) {
      const first = this.map.keys().next().value;
      this.map.delete(first);
    }
  }

  set(key, value) {
    this._touch(key, value);
    // persist asynchronously
    if (this.db) {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id: key, value, ts: Date.now() });
    }
  }

  get(key) {
    const v = this.map.get(key);
    if (v) {
      this.map.delete(key);
      this.map.set(key, v);
      return v;
    }
    return null;
  }

  has(key) { return this.map.has(key); }

  async loadRecent(limit = 50) {
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const items = [];
      const req = store.openCursor(null, 'prev');
      req.onsuccess = (e) => {
        const cur = e.target.result;
        if (cur && items.length < limit) {
          items.push(cur.value);
          cur.continue();
        } else resolve(items);
      };
      req.onerror = () => resolve(items);
    });
  }

  prune() {
    while (this.map.size > this.maxEntries) {
      const first = this.map.keys().next().value;
      this.map.delete(first);
    }
  }
}