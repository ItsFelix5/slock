import { expect, test } from "bun:test";
import { parseUserId } from "@slock/slack";
import type { User } from "@slock/types";
import { selfInputSeed } from "../../../../../packages/plugins/src/profile/client/views/selfInputSeed";

const ME = parseUserId("UME");
const me: User = {
  avatarColor: "#000",
  id: ME,
  name: "Me",
  realName: "Real Me",
  statusEmoji: ":tada:",
  statusText: "busy",
  title: "Dev",
};

test("seeds every self field when viewing yourself", () => {
  expect(selfInputSeed(ME, me)).toEqual({
    fullName: "Real Me",
    name: "Me",
    pronouns: "",
    statusEmoji: ":tada:",
    statusText: "busy",
    title: "Dev",
  });
});

test("the full name falls back to the name", () => {
  expect(selfInputSeed(ME, { ...me, realName: undefined }).fullName).toBe("Me");
});

test("seeds nothing for another user or before you are known", () => {
  expect(selfInputSeed(parseUserId("UOTHER"), me)).toEqual({});
  expect(selfInputSeed(ME, undefined)).toEqual({});
});
