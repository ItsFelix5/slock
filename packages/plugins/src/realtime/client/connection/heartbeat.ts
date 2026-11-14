type Timer = ReturnType<typeof setInterval>;

export function createHeartbeat(opts: {
  onDead: () => void;
  ping: () => void;
  clearTimer?: (timer: Timer) => void;
  intervalMs?: number;
  setTimer?: (callback: () => void, delay: number) => Timer;
}) {
  const intervalMs = opts.intervalMs ?? 20_000;
  const clearTimer = opts.clearTimer ?? clearInterval;
  const setTimer = opts.setTimer ?? setInterval;
  let awaitingReply = false;
  let timer: Timer | undefined;

  const stop = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    awaitingReply = false;
  };

  return {
    heard() {
      awaitingReply = false;
    },
    start() {
      stop();
      timer = setTimer(() => {
        if (awaitingReply) {
          stop();
          opts.onDead();
          return;
        }
        awaitingReply = true;
        opts.ping();
      }, intervalMs);
    },
    stop,
  };
}
