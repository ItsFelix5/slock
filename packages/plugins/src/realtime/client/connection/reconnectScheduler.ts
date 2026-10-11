type Timer = ReturnType<typeof setTimeout>;

export function createReconnectScheduler(opts: {
  connect: () => void;
  isOnline: () => boolean;
  clearTimer?: (timer: Timer) => void;
  initialDelay?: number;
  maxDelay?: number;
  setTimer?: (callback: () => void, delay: number) => Timer;
}) {
  const initialDelay = opts.initialDelay ?? 1000;
  const maxDelay = opts.maxDelay ?? 20000;
  const clearTimer = opts.clearTimer ?? clearTimeout;
  const setTimer = opts.setTimer ?? setTimeout;
  let delay = initialDelay;
  let disposed = false;
  let timer: Timer | undefined;

  const cancel = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };

  return {
    connected() {
      cancel();
      delay = initialDelay;
    },
    dispose() {
      disposed = true;
      cancel();
    },
    pause: cancel,
    reconnectNow() {
      cancel();
      if (!(disposed || !opts.isOnline())) opts.connect();
    },
    schedule() {
      if (disposed || timer !== undefined || !opts.isOnline()) return;
      const wait = delay;
      delay = Math.min(Math.ceil(delay * 1.7), maxDelay);
      timer = setTimer(() => {
        timer = undefined;
        if (!(disposed || !opts.isOnline())) opts.connect();
      }, wait);
      return wait;
    },
  };
}
