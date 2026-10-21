/* Kleine Promise-Hülle um IndexedDB. Alle Daten bleiben lokal im Browser. */
(function () {
  const DB_NAME = 'flurstueck-inventar';
  const DB_VERSION = 1;
  const STORES = ['parcels', 'comments', 'documents', 'blobs'];
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('parcels', { keyPath: 'id' });
        db.createObjectStore('comments', { keyPath: 'id' }).createIndex('parcelId', 'parcelId');
        db.createObjectStore('documents', { keyPath: 'id' }).createIndex('parcelId', 'parcelId');
        db.createObjectStore('blobs', { keyPath: 'id' }); // Dateiinhalte getrennt von den Metadaten
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      const r = fn(s);
      if (r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const DB = {
    getAll: (store) => tx(store, 'readonly', (s) => s.getAll()),
    get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
    put: (store, value) => tx(store, 'readwrite', (s) => s.put(value)),
    del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
    clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
    async clearAll() { for (const s of STORES) await DB.clear(s); },
    async putMany(store, values) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        values.forEach((v) => t.objectStore(store).put(v));
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    },
  };

  window.DB = DB;
})();
