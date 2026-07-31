export function createSerialMutationQueue() {
  let tail = Promise.resolve();

  return function runSerially<T>(mutation: () => Promise<T>): Promise<T> {
    const result = tail.then(mutation);
    // A rejected mutation is still returned to its caller, but must not poison
    // the shared tail and prevent the next user edit from ever being sent.
    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  };
}
