import { parseTs } from "@slock/slack";
import type { Ts } from "@slock/types";

const MICROSECOND_SECONDS = 0.000001;

export const tsToMs = (ts: Ts): number => Number(ts) * 1000;

export const tsFromMs = (ms: number): Ts => parseTs((ms / 1000).toFixed(6));

export const tsJustBefore = (ts: Ts): Ts => parseTs((Number(ts) - MICROSECOND_SECONDS).toFixed(6));
