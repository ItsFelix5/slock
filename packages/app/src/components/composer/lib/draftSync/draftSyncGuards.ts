export function createDraftPersistenceGate() {
  let currentKey: string | undefined;

  return {
    shouldPersist(key: string): boolean {
      if (key === currentKey) return true;
      currentKey = key;
      return false;
    },
  };
}

export async function saveAfterDraftHydration(
  hydrate: () => Promise<boolean>,
  save: () => Promise<void>,
): Promise<boolean> {
  if (!(await hydrate())) return false;
  await save();
  return true;
}
