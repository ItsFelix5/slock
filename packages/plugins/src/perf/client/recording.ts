export type ScriptRecord = {
  name: string;
  source: string;
  duration: number;
};

export type FrameRecord = {
  path: string;
  duration: number;
  blocking: number;
  styleLayout: number;
  scripts: ScriptRecord[];
};

export type InteractionRecord = {
  path: string;
  type: string;
  target: string;
  duration: number;
  delay: number;
  processing: number;
  presentation: number;
};

export type ShiftRecord = {
  path: string;
  value: number;
  target: string;
};

export type HeapSample = {
  at: number;
  mb: number;
};

export type Recording = {
  frames: FrameRecord[];
  interactions: InteractionRecord[];
  shifts: ShiftRecord[];
  heap: HeapSample[];
};
