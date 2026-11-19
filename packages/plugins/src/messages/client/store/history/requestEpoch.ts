export function createRequestEpochs<Key>() {
  const epochs = new Map<Key, number>();
  return {
    begin(key: Key) {
      const epoch = (epochs.get(key) ?? 0) + 1;
      epochs.set(key, epoch);
      return epoch;
    },
    current(key: Key) {
      return epochs.get(key) ?? 0;
    },
    isCurrent(key: Key, epoch: number) {
      return epochs.get(key) === epoch;
    },
  };
}
