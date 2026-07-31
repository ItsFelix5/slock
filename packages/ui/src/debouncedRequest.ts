export interface DebouncedRequestOptions<T> {
  delay?: number;
  onError?: (error: unknown, query: string) => void;
  onPendingChange?: (pending: boolean) => void;
  onReset?: () => void;
  onResult: (result: T, query: string) => void;
}

export function createDebouncedRequest<T>(
  request: (query: string) => Promise<T>,
  options: DebouncedRequestOptions<T>,
) {
  let disposed = false;
  let requestId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = (rawQuery: string) => {
    if (disposed) return;
    clearTimeout(timer);
    timer = undefined;
    const id = ++requestId;
    const query = rawQuery.trim();
    options.onReset?.();
    if (!query) {
      options.onPendingChange?.(false);
      return;
    }

    options.onPendingChange?.(true);
    timer = setTimeout(() => {
      timer = undefined;
      void request(query)
        .then((result) => {
          if (!(disposed || id !== requestId)) options.onResult(result, query);
        })
        .catch((error) => {
          if (!(disposed || id !== requestId)) options.onError?.(error, query);
        })
        .finally(() => {
          if (!(disposed || id !== requestId)) options.onPendingChange?.(false);
        });
    }, options.delay ?? 250);
  };

  const dispose = () => {
    disposed = true;
    requestId += 1;
    clearTimeout(timer);
    timer = undefined;
  };

  return { dispose, run };
}
