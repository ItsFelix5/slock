export interface Deferred<T = void> {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
}

export function deferred<T = void>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}
