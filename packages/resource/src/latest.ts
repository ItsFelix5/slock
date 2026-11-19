export type LatestOutcome<T> = { current: true; value: T } | { current: false };

export interface Latest {
  begin(): () => boolean;
  invalidate(): void;
  run<T>(task: () => Promise<T>): Promise<LatestOutcome<T>>;
}

export function createLatest(): Latest {
  let epoch = 0;

  const begin = () => {
    const mine = ++epoch;
    return () => mine === epoch;
  };

  const run = async <T>(task: () => Promise<T>): Promise<LatestOutcome<T>> => {
    const isCurrent = begin();
    try {
      const value = await task();
      return isCurrent() ? { current: true, value } : { current: false };
    } catch (error) {
      if (isCurrent()) throw error;
      return { current: false };
    }
  };

  return {
    begin,
    invalidate: () => {
      epoch++;
    },
    run,
  };
}
