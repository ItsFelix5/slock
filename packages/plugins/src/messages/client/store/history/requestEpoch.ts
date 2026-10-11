export function createRequestEpochs() {
  const epochs = new Map<string, number>();
  return {
    begin(key: string) {
      const epoch = (epochs.get(key) ?? 0) + 1;
      epochs.set(key, epoch);
      return epoch;
    },
    current(key: string) {
      return epochs.get(key) ?? 0;
    },
    isCurrent(key: string, epoch: number) {
      return epochs.get(key) === epoch;
    },
  };
}
