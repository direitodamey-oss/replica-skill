// Persistência no navegador. IndexedDB porque anexos em base64 estouram
// o limite do localStorage; se o IndexedDB falhar, fica tudo em memória.

const DB_NAME = 'orquestra';
const STORE = 'kv';
let dbPromise = null;
const memory = new Map();

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function load(key, fallback) {
  const db = await openDb();
  if (!db) return memory.has(key) ? memory.get(key) : fallback;
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result);
    req.onerror = () => resolve(fallback);
  });
}

export async function save(key, value) {
  const db = await openDb();
  if (!db) {
    memory.set(key, value);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function pref(key, fallback) {
  try {
    const v = localStorage.getItem('orquestra:' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    localStorage.setItem('orquestra:' + key, JSON.stringify(value));
  } catch {
    /* preferência não salva: sem problema */
  }
}
