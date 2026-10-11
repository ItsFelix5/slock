const DB_NAME = "slock-plugins";
const STORE = "plugins";

export type StoredPlugin = { id: string; name: string; code: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function listStoredPlugins(): Promise<StoredPlugin[]> {
  return run("readonly", (store) => store.getAll());
}

export async function saveStoredPlugin(plugin: StoredPlugin): Promise<void> {
  await run("readwrite", (store) => store.put(plugin));
}

export async function removeStoredPlugin(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}
