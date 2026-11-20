type Task = () => void;

export interface MountQueueEnv {
  frame: (run: () => void) => void;
  idle: (run: (remainingMs: () => number) => void) => void;
  now: () => number;
}

export interface MountHandle {
  cancel: () => void;
  promote: () => void;
}

const FRAME_BUDGET_MS = 6;
const IDLE_MIN_MS = 8;

const browserEnv: MountQueueEnv = {
  frame: (run) => requestAnimationFrame(() => setTimeout(run, 0)),
  idle: (run) =>
    "requestIdleCallback" in globalThis
      ? requestIdleCallback((deadline) => run(() => deadline.timeRemaining()), {
          timeout: 2000,
        })
      : void setTimeout(() => run(() => IDLE_MIN_MS + 1), 50),
  now: () => performance.now(),
};

export function createMountQueue(env: MountQueueEnv = browserEnv) {
  const urgent: Task[] = [];
  const background: Task[] = [];
  let frameQueued = false;
  let idleQueued = false;

  function remove(lane: Task[], task: Task) {
    const at = lane.indexOf(task);
    if (at >= 0) lane.splice(at, 1);
  }

  function runFrame() {
    frameQueued = false;
    const start = env.now();
    do urgent.pop()?.();
    while (urgent.length && env.now() - start < FRAME_BUDGET_MS);
    if (urgent.length) scheduleFrame();
  }

  function runIdle(remainingMs: () => number) {
    idleQueued = false;
    do background.pop()?.();
    while (background.length && remainingMs() > IDLE_MIN_MS);
    if (background.length) scheduleIdle();
  }

  function scheduleFrame() {
    if (frameQueued) return;
    frameQueued = true;
    env.frame(runFrame);
  }

  function scheduleIdle() {
    if (idleQueued) return;
    idleQueued = true;
    env.idle(runIdle);
  }

  return {
    add(task: Task): MountHandle {
      background.push(task);
      scheduleIdle();
      return {
        cancel() {
          remove(background, task);
          remove(urgent, task);
        },
        promote() {
          const at = background.indexOf(task);
          if (at < 0) return;
          background.splice(at, 1);
          urgent.push(task);
          scheduleFrame();
        },
      };
    },
  };
}

export const mountQueue = createMountQueue();
