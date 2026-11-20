import type { PersistAdapter, StoredSnapshot } from "@slock/resource";

const DB_NAME = "slock-query";
const STORE = "snapshots";
const SEPARATOR = "/";

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

function isSnapshot(value: unknown): value is StoredSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "number" &&
    "entries" in value &&
    Array.isArray(value.entries)
  );
}

export const noPersistence: PersistAdapter = {
  load: () => Promise.resolve(undefined),
  save: () => Promise.resolve(),
};

export function createIdbAdapter(account: string): PersistAdapter {
  const slot = (name: string) => `${account}${SEPARATOR}${name}`;
  return {
    load: async (name) => {
      const stored: unknown = await run("readonly", (store) => store.get(slot(name)));
      return isSnapshot(stored) ? stored : undefined;
    },
    save: async (name, snapshot) => {
      await run("readwrite", (store) => store.put(snapshot, slot(name)));
    },
  };
}

export async function pruneSnapshots(keep: readonly string[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        const owned = keep.some((account) => String(key).startsWith(`${account}${SEPARATOR}`));
        if (!owned) store.delete(key);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
