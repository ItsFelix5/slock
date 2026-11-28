import { describe, expect, test } from "bun:test";
import { mapUser, parseChannelId } from "@slock/slack";
import { rankJumps } from "../../../../../packages/plugins/src/search/client/engine/jumpRanking";

const channel = (id: string, name: string) => ({
  id: parseChannelId(id),
  name,
  private: false,
});
const empty = { channels: [], groups: [], remoteChannels: [], remoteUsers: [], users: [] };
const ids = (...args: Parameters<typeof rankJumps>) => rankJumps(...args).map((row) => row.id);

describe("rankJumps", () => {
  test("joined channels win over ones only the server knows", () => {
    const pool = {
      ...empty,
      channels: [channel("C1", "general")],
      remoteChannels: [{ ...channel("C2", "general-old"), isMember: false, topic: "" }],
    };
    expect(ids("general", pool, () => 0)).toEqual(["C1", "C2"]);
  });

  test("a row known locally and remotely shows once", () => {
    const pool = {
      ...empty,
      channels: [channel("C1", "general")],
      remoteChannels: [{ ...channel("C1", "general"), isMember: true, topic: "" }],
    };
    expect(ids("gen", pool, () => 0)).toEqual(["C1"]);
  });

  test("server matches the fuzzy search misses stay at the end", () => {
    const pool = {
      ...empty,
      channels: [channel("C1", "design")],
      remoteUsers: [mapUser({ id: "U1", name: "someone" })],
    };
    expect(ids("design", pool, () => 0)).toEqual(["C1", "U1"]);
  });
});
