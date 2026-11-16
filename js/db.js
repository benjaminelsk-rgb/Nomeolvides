// Base de datos local (IndexedDB). Todo se guarda en el dispositivo.
const NOMBRE = 'nomeolvides';
const VERSION = 1;
let dbPromise = null;

function abrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('ideas')) db.createObjectStore('ideas', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('ramas')) db.createObjectStore('ramas', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('audios')) db.createObjectStore('audios', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'clave' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, modo, fn) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, modo);
    const s = t.objectStore(store);
    let resultado;
    Promise.resolve(fn(s)).then((r) => { resultado = r; });
    t.oncomplete = () => resolve(resultado);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  todos: (store) => tx(store, 'readonly', (s) => reqP(s.getAll())),
  obtener: (store, id) => tx(store, 'readonly', (s) => reqP(s.get(id))),
  guardar: (store, valor) => tx(store, 'readwrite', (s) => reqP(s.put(valor))),
  borrar: (store, id) => tx(store, 'readwrite', (s) => reqP(s.delete(id))),
  vaciar: (store) => tx(store, 'readwrite', (s) => reqP(s.clear())),
  async meta(clave, valorPorDefecto = null) {
    const r = await this.obtener('meta', clave);
    return r ? r.valor : valorPorDefecto;
  },
  setMeta: (clave, valor) => tx('meta', 'readwrite', (s) => reqP(s.put({ clave, valor })))
};

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
