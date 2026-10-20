export type PerfStats = {
  frames: number;
  interactions: number;
};

export type PerfService = {
  stats(): PerfStats;
  report(): string;
  clear(): void;
};

declare module "@slock/core/types" {
  interface Services {
    perf: PerfService;
  }
}
