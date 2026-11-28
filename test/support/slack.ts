import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import {
  parseChannelId,
  parseFileId,
  parseTeamId,
  parseTs,
  parseUserId,
} from "../../packages/slack/src/ids";
import { createFakeEnv } from "./core";

export const ch = parseChannelId;
export const fid = parseFileId;
export const tid = parseTeamId;
export const stamp = parseTs;
export const uid = parseUserId;

export function startSlackHost(env = createFakeEnv()) {
  setHost(createHost({ env, reactive: solidReactive }));
  return env;
}
