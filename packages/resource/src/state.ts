export type EntryState<T> =
  | {
      status: "idle";
      data: undefined;
      error: undefined;
      failures: 0;
      refreshing: false;
      stale: false;
    }
  | {
      status: "loading";
      data: undefined;
      error: undefined;
      failures: number;
      refreshing: true;
      stale: boolean;
    }
  | {
      status: "ready";
      data: T;
      error: undefined;
      failures: 0;
      refreshing: boolean;
      stale: boolean;
    }
  | {
      status: "error";
      data: T | undefined;
      error: unknown;
      failures: number;
      refreshing: boolean;
      stale: boolean;
    };

export type StateListener<T> = (state: EntryState<T>) => void;

export const IDLE: EntryState<never> = {
  data: undefined,
  error: undefined,
  failures: 0,
  refreshing: false,
  status: "idle",
  stale: false,
};

export function isWaiting<T>(state: EntryState<T>): boolean {
  return state.status === "idle" || state.status === "loading";
}
