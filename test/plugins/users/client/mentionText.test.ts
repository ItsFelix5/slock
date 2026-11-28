import { expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import { createFakeEnv, partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { user } from "./startUsers";

test("mention markup in titles reads as names", async () => {
  await startQueryHost(createFakeEnv(), {
    id: "names",
    setup: (ctx) => {
      ctx.provide("titles", partialService<Services["titles"]>({ label: () => "#general" }));
      ctx.provide(
        "users",
        partialService<Services["users"]>({ userById: (id) => user(id, "ada") }),
      );
    },
  });
  const { mentionText } = await import("../../../../packages/plugins/src/users/client/api");

  expect(mentionText("<#C0M8PUPU6> Guidelines")).toBe("#general Guidelines");
  expect(mentionText("<#C0M8PUPU6|rules> by <@U1>")).toBe("#rules by @ada");
  expect(mentionText("a <b> & <!here>")).toBe("a <b> & <!here>");
});
