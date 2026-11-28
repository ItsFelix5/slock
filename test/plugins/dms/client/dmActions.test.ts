import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import type { Services } from "@slock/core/types";
import type { View } from "@slock/plugins/conversations/client/api/types";
import { createRoot, flush } from "solid-js";
import { createFakeEnv, partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch, uid } from "../../../support/slack";

const ANA = uid("UANA");
const DM = ch("D1");

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status });

async function start() {
  const env = createFakeEnv(1, 1_000_000);
  const flashes: string[] = [];
  const shown: View[] = [];
  const host = await startQueryHost(env);
  await host.register({
    id: "feedback",
    setup: (ctx) =>
      ctx.provide(
        "feedback",
        partialService<Services["feedback"]>({
          flash: (_key, message) => flashes.push(message),
        }),
      ),
  });
  env.fetch.hold(/\/api\/(dms|channels)/);
  const { createDmsStore } = await import("../../../../packages/plugins/src/dms/client/store");
  const store = createRoot(() =>
    createDmsStore({
      activeView: () => null,
      addJoinedChannel: () => {},
      bootstrap: () => undefined,
      closeUserProfile: () => {},
      currentUser: () => undefined,
      openInPane: () => "",
      setActiveView: (view) => shown.push(view),
      showAsChannel: () => {},
    }),
  );
  const answer = (response: Response) => env.fetch.pending()[0]?.resolve(response);
  return { answer, env, flashes, host, shown, store };
}

test("a second open while one is in flight is refused, then the chat shows", async () => {
  const h = await start();
  const first = h.store.openDmWithUser(ANA);
  expect(h.store.isOpenDmPending(ANA)).toBe(true);
  expect(await h.store.openDmWithUser(ANA)).toBe(false);
  expect(h.env.fetch.calls.length).toBe(1);
  h.answer(json({ channel: { id: DM }, ok: true }));
  expect(await first).toBe(true);
  flush();
  expect(h.store.isOpenDmPending(ANA)).toBe(false);
  expect(h.store.dmIdForUser(ANA)).toBe(DM);
  expect(h.shown).toEqual([{ id: DM, kind: "dm" }]);
  h.host.stop();
});

test("failed open and close flash and leave the list alone", async () => {
  const h = await start();
  const opened = h.store.openDmWithUser(ANA);
  h.answer(json({ error: "nope" }, 500));
  expect(await opened).toBe(false);
  h.store.ensureDm(DM, ANA);
  flush();
  const closed = h.store.closeDmConversation(DM);
  expect(h.store.isCloseDmPending(DM)).toBe(true);
  h.answer(json({ error: "nope" }, 500));
  expect(await closed).toBe(false);
  flush();
  expect(h.store.directMessages().map((dm) => dm.id)).toEqual([DM]);
  expect(h.flashes).toEqual([
    "Could not open a direct message with this user.",
    "Failed to close conversation.",
  ]);
  h.host.stop();
});
