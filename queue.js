/* queue.js
   Simple async processing queue with optional persistence (IndexedDB) so tasks survive reloads.
   Provides enqueue(task), process(handler) and drain() operations.
*/

const Q_DB = 'sinal-pro-queue';
const Q_STORE = 'tasks';

export class AsyncQueue {
  constructor() {
    this.running = false;
    this.db = null;
    this._init();
  }

  async _init() {
    if (!('indexedDB' in window)) return;
    return new Promise((resolve) => {
      const req = indexedDB.open(Q_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(Q_STORE)) db.createObjectStore(Q_STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => resolve();
    });
  }

  async enqueue(payload) {
    if (this.db) {
      const tx = this.db.transaction(Q_STORE, 'readwrite');
      tx.objectStore(Q_STORE).add({ payload, ts: Date.now() });
      return;
    }
    // fallback in-memory queue
    this._memQueue = this._memQueue || [];
    this._memQueue.push({ payload, ts: Date.now() });
  }

  async drain(handler) {
    if (this.db) {
      const tx = this.db.transaction(Q_STORE, 'readwrite');
      const store = tx.objectStore(Q_STORE);
      const req = store.openCursor();
      req.onsuccess = async (e) => {
        const cur = e.target.result;
        if (cur) {
          try {
            await handler(cur.value.payload);
            store.delete(cur.primaryKey);
            cur.continue();
          } catch (err) {
            // if handler fails, stop processing to avoid tight error loop
            console.error('Queue handler error', err);
          }
        }
      };
    } else {
      // process in-memory queue
      this._memQueue = this._memQueue || [];
      while (this._memQueue.length) {
        const item = this._memQueue.shift();
        try { await handler(item.payload); } catch(e){ console.error('Queue handler error', e); break; }
      }
    }
  }
}