interface TaskQueue {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createQueue(concurrency: number): TaskQueue {
  let active = 0;
  const waiting: (() => void)[] = [];

  function next() {
    if (active >= concurrency) return;
    const start = waiting.shift();
    if (!start) return;
    active++;
    start();
  }

  return {
    run: (task) =>
      new Promise((resolve, reject) => {
        waiting.push(() => {
          task()
            .then(resolve, reject)
            .finally(() => {
              active--;
              next();
            });
        });
        next();
      }),
  };
}
