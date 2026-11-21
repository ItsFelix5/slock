const CHUNK_LIMIT = 3;

export function createChunkPool() {
  let inFlight = 0;
  const waiting: (() => void)[] = [];
  return function loadChunk<T>(fetchChunk: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        inFlight++;
        fetchChunk()
          .then(resolve, reject)
          .finally(() => {
            inFlight--;
            waiting.shift()?.();
          });
      };
      if (inFlight < CHUNK_LIMIT) run();
      else waiting.push(run);
    });
  };
}
