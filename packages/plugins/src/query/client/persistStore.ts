const DB_NAME = "slock-query";
const STORE = "snapshots";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export const readSnapshot = (account: string): Promise<unknown> =>
  run("readonly", (store) => store.get(account));

export const writeSnapshot = (account: string, snapshot: unknown): Promise<IDBValidKey> =>
  run("readwrite", (store) => store.put(snapshot, account));

export async function pruneSnapshots(keep: readonly string[]): Promise<void> {
  const keys = await run("readonly", (store) => store.getAllKeys());
  for (const key of keys)
    if (typeof key === "string" && !keep.includes(key))
      await run("readwrite", (store) => store.delete(key));
}
