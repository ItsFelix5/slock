import type { Env, TimerHandle } from "@slock/core";

export function createHeartbeat(opts: {
  env: Env;
  onDead: () => void;
  ping: () => void;
  intervalMs?: number;
}) {
  const intervalMs = opts.intervalMs ?? 20_000;
  let awaitingReply = false;
  let timer: TimerHandle | undefined;

  const stop = () => {
    opts.env.clearInterval(timer);
    timer = undefined;
    awaitingReply = false;
  };

  return {
    heard() {
      awaitingReply = false;
    },
    start() {
      stop();
      timer = opts.env.setInterval(() => {
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
