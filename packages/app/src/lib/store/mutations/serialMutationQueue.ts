export function createSerialMutationQueue() {
  let tail = Promise.resolve();

  return function runSerially<T>(mutation: () => Promise<T>): Promise<T> {
    const result = tail.then(mutation);

    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  };
}
