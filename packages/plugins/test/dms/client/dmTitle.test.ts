import { describe, expect, test } from "bun:test";
import { ch, uid } from "@slock/slack/testing";
import type { ChannelId, DirectMessage, User, UserId } from "@slock/types";
import { createDmTitleResolver } from "../../../src/dms/client/dmTitle";

const user = (id: string, name: string): User => ({ avatarColor: "#000", id: uid(id), name });
const users = new Map(
  [user("U1", "Ann"), user("U2", "Bo"), user("U3", "Cy")].map((u) => [u.id, u]),
);
const dm = (fields: Partial<DirectMessage> & Pick<DirectMessage, "id">): DirectMessage => ({
  unread: false,
  ...fields,
});

function titleFor(id: ChannelId, ...dms: DirectMessage[]) {
  const byId = new Map(dms.map((d) => [d.id, d]));
  return createDmTitleResolver(
    (key) => byId.get(key),
    (key: UserId) => users.get(key),
  )(id);
}

describe("dm title", () => {
  test("one to one shows the other person", () => {
    expect(titleFor(ch("D1"), dm({ id: ch("D1"), userId: uid("U1") }))).toEqual({ name: "Ann" });
  });

  test("group dm lists member names in order", () => {
    expect(
      titleFor(ch("G1"), dm({ id: ch("G1"), memberIds: [uid("U2"), uid("U1"), uid("U3")] })),
    ).toEqual({ name: "Bo, Ann, Cy" });
  });

  test("group dm with an unresolved member says Someone", () => {
    expect(
      titleFor(ch("G1"), dm({ id: ch("G1"), memberIds: [uid("U1"), uid("UGONE")] })),
    ).toEqual({ name: "Ann, Someone" });
  });

  test("a custom group name wins over member names", () => {
    expect(
      titleFor(
        ch("G1"),
        dm({ id: ch("G1"), memberIds: [uid("U1"), uid("U2")], name: "Lunch crew" }),
      ),
    ).toEqual({ name: "Lunch crew" });
  });

  test("falls back to the id while the user or members are missing", () => {
    expect(titleFor(ch("D1"), dm({ id: ch("D1"), userId: uid("UGONE") }))).toEqual({ name: "D1" });
    expect(titleFor(ch("G1"), dm({ id: ch("G1"), memberIds: [] }))).toEqual({ name: "G1" });
    expect(titleFor(ch("D1"), dm({ id: ch("D1") }))).toEqual({ name: "D1" });
  });

  test("returns nothing for a channel and claims unknown D ids", () => {
    expect(titleFor(ch("C1"))).toBeUndefined();
    expect(titleFor(ch("G9"))).toBeUndefined();
    expect(titleFor(ch("D9"))).toEqual({ name: "D9" });
  });
});
