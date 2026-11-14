import { describe, expect, test } from "bun:test";
import type { UsergroupDetails } from "@slock/types";
import {
  editableUsergroupDetails,
  mergeUsergroupDetailsDraft,
} from "../../../../src/usergroup-details/client/views/usergroupDetailsDraft";

const details = (overrides: Partial<UsergroupDetails> = {}): UsergroupDetails => ({
  channelIds: [],
  description: "desc",
  handle: "eng",
  id: "S1",
  isSection: false,
  memberCount: 0,
  memberIds: [],
  title: "Engineering",
  ...overrides,
});

describe("mergeUsergroupDetailsDraft", () => {
  const server = editableUsergroupDetails(details());

  test("takes the server values for untouched fields", () => {
    const next = details({ description: "new desc", handle: "eng2", title: "Eng" });
    expect(
      mergeUsergroupDetailsDraft(
        { description: "desc", handle: "eng", title: "Engineering" },
        server,
        next,
      ),
    ).toEqual({ description: "new desc", handle: "eng2", title: "Eng" });
  });

  test("keeps fields the user edited", () => {
    const next = details({ description: "server desc", title: "Server title" });
    expect(
      mergeUsergroupDetailsDraft(
        { description: "desc", handle: "mine", title: "My title" },
        server,
        next,
      ),
    ).toEqual({ description: "server desc", handle: "mine", title: "My title" });
  });

  test("a different group replaces the whole draft", () => {
    const other = details({ description: "o", handle: "ops", id: "S2", title: "Ops" });
    expect(
      mergeUsergroupDetailsDraft({ description: "x", handle: "y", title: "z" }, server, other),
    ).toEqual({ description: "o", handle: "ops", title: "Ops" });
  });

  test("the first load takes the server values", () => {
    expect(
      mergeUsergroupDetailsDraft({ description: "", handle: "", title: "" }, undefined, details()),
    ).toEqual({ description: "desc", handle: "eng", title: "Engineering" });
  });
});
