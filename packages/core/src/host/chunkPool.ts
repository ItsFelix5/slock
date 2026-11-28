const CHUNK_LIMIT = 3;

type ChunkPriority = "urgent" | "background";

export function createChunkPool() {
  let inFlight = 0;
  const waiting: Record<ChunkPriority, (() => void)[]> = { background: [], urgent: [] };
  return function loadChunk<T>(
    fetchChunk: () => Promise<T>,
    priority: ChunkPriority = "urgent",
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        inFlight++;
        fetchChunk()
          .then(resolve, reject)
          .finally(() => {
            inFlight--;
            (waiting.urgent.shift() ?? waiting.background.shift())?.();
          });
      };
      if (inFlight < CHUNK_LIMIT) run();
      else waiting[priority].push(run);
    });
  };
}
