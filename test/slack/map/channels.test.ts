import { describe, expect, test } from "bun:test";
import type { RawChannel } from "@slock/types";
import { extractChannelSections } from "../../../packages/plugins/src/channels/client/requests/sections";
import {
  canvasFileIdOf,
  mapChannel,
  mapChannelDetails,
} from "../../../packages/slack/src/map/channels";
import { forAll } from "../../support/core";
import { ch, fid } from "../../support/slack";
import { garbageRecord, viaJson } from "../garbage";

const CHANNEL_SPEC = {
  created: "number",
  creator: "userId",
  is_archived: "boolean",
  is_file: "boolean",
  is_private: "boolean",
  latest: "string",
  member_count: "number",
  name: "string",
  name_normalized: "string",
  num_members: "number",
  purpose: { record: { value: "string" } },
  topic: { record: { value: "string" } },
  unread_count: "number",
  unread_count_display: "number",
} as const;

describe("mapChannel", () => {
  test("maps a regular channel", () => {
    expect(
      mapChannel({
        id: "C1",
        is_private: true,
        latest: "1700000000.000000",
        name: "general",
        num_members: 3,
        topic: { value: "topic" },
        unread_count_display: 2,
      }),
    ).toEqual({
      archived: false,
      canvasFileId: undefined,
      id: ch("C1"),
      lastActivity: 1700000000000,
      memberCount: 3,
      name: "general",
      private: true,
      topic: "topic",
      unread: true,
    });
  });

  test("accepts topic as a plain string", () => {
    expect(mapChannel({ id: "C1", topic: "plain" }).topic).toBe("plain");
  });

  test("falls back to the id when the name is missing", () => {
    expect(mapChannel({ id: "D1" }).name).toBe("D1");
  });

  test("display count wins over the raw count even at zero", () => {
    expect(mapChannel({ id: "C1", unread_count: 4, unread_count_display: 0 }).unread).toBe(false);
  });

  test("canvas comment channels point at the file", () => {
    const channel = mapChannel({ id: "C123", is_file: true, name: "whatever" });
    expect(channel).toMatchObject({ canvasFileId: fid("F123"), name: "Canvas comments" });
    expect(canvasFileIdOf({ id: "C9", name_normalized: "FC:abc" })).toBe(fid("F9"));
    expect(canvasFileIdOf({ id: "C9" })).toBeUndefined();
  });

  test("never throws on garbage and keeps the id", () => {
    forAll(
      (random) => ({ ...garbageRecord(random, CHANNEL_SPEC), id: "C9" }),
      (garbage) => {
        const raw = viaJson<RawChannel>(garbage);
        expect(mapChannel(raw).id).toBe(ch("C9"));
        expect(mapChannelDetails(raw).id).toBe(ch("C9"));
      },
      500,
    );
  });
});

describe("mapChannelDetails", () => {
  test("empty creator and email become undefined", () => {
    const details = mapChannelDetails({
      creator: "",
      id: "C1",
      properties: { channel_email_addresses: [] },
    });
    expect(details).toMatchObject({
      created: 0,
      creatorId: undefined,
      email: undefined,
      purpose: "",
    });
  });

  test("reads the first email address", () => {
    const details = mapChannelDetails({
      id: "C1",
      properties: { channel_email_addresses: [{ address: "a@b.c" }, { address: "x@y.z" }] },
    });
    expect(details.email).toBe("a@b.c");
  });
});

describe("extractChannelSections", () => {
  test("returns null without a list", () => {
    expect(extractChannelSections(undefined)).toBeNull();
    expect(extractChannelSections({})).toBeNull();
  });

  test("reads channel ids from any of the three shapes", () => {
    const sections = extractChannelSections({
      channel_sections: [
        { channel_ids: ["C1"], channel_section_id: "S1" },
        { channel_ids_page: { channel_ids: ["C2"] }, channel_section_id: "S2" },
        { channel_section_id: "S3", channels: ["C3"] },
        { channel_section_id: "S4" },
      ],
    });
    expect(sections?.map((section) => section.channelIds)).toEqual([
      [ch("C1")],
      [ch("C2")],
      [ch("C3")],
      [],
    ]);
  });

  test("unknown sidebar values hide the section and ids fall back to name", () => {
    const sections = extractChannelSections({
      channel_sections: [
        { name: "Stars", sidebar: "all" },
        { channel_section_id: "S1", sidebar: "weird" },
        { channel_section_id: "S2", sidebar: "active" },
        {},
      ],
    });
    expect(sections?.map((section) => [section.id, section.sidebar])).toEqual([
      ["Stars", "all"],
      ["S1", "hid"],
      ["S2", "active"],
    ]);
  });
});
