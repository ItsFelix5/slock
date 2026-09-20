export interface ConcurrencyQueue {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createConcurrencyQueue(limit: number): ConcurrencyQueue {
  let active = 0;
  const queue: (() => void)[] = [];

  function runNext() {
    if (active >= limit) return;
    const task = queue.shift();
    if (!task) return;
    active++;
    task();
  }

  function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            runNext();
          });
      });
      runNext();
    });
  }

  return { run };
}

export const backgroundFetchQueue = createConcurrencyQueue(4);
