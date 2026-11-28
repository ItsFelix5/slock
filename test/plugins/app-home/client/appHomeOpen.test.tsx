import { expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import { provideUi } from "@slock/ui";
import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import querySetup from "../../../../packages/plugins/src/query/client/index";
import { createFakeEnv, partialService } from "../../../support/core";
import { ch, uid } from "../../../support/slack";

const BOT = uid("UBOT");
const A = ch("D1");
const B = ch("D2");

const settle = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
    flush();
  }
};

async function takeover(open: () => Response) {
  const env = createFakeEnv(1, 1_000_000);
  env.fetch.respond(/app-home$/, () =>
    Response.json({ appHome: { app_id: "A1", home_tab_enabled: true }, ok: true, view: null }),
  );
  env.fetch.respond(/app-home\/open$/, open);
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
    {
      id: "dms",
      setup: (ctx) =>
        ctx.provide(
          "dms",
          partialService<Services["dms"]>({ dmById: (id) => ({ id, unread: false, userId: BOT }) }),
        ),
    },
    {
      id: "users",
      setup: (ctx) =>
        ctx.provide(
          "users",
          partialService<Services["users"]>({
            userById: (id) => ({ avatarColor: "#000", id, isBot: true, name: "Bot" }),
          }),
        ),
    },
  );
  const { default: AppHomeTakeover } = await import(
    "../../../../packages/plugins/src/app-home/client/views/AppHomeTakeover"
  );
  const [id, setId] = createSignal(A);
  const root = document.createElement("div");
  const dispose = render(() => <AppHomeTakeover id={id()} kind="dm" />, root);
  await settle();
  return {
    dispose,
    opened: () =>
      env.fetch.calls
        .filter((call) => /app-home\/open$/.test(call.url))
        .map((call) => call.url.split("/")[3]),
    async show(next: typeof A) {
      setId(next);
      await settle();
    },
  };
}

test("opening the home is dispatched again when the channel changes but the app does not", async () => {
  const warn = spyOn(console, "warn");
  const view = await takeover(() => Response.json({ ok: true }));
  await view.show(B);
  view.dispose();
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
  expect(view.opened()).toEqual([A, B]);
});

test("a refused home open is logged instead of left unhandled", async () => {
  const logged = spyOn(console, "error").mockImplementation(() => {});
  const view = await takeover(() =>
    Response.json({ error: "not_allowed", ok: false }, { status: 403 }),
  );
  view.dispose();
  expect(logged.mock.calls.map(([message]) => message)).toContain("Failed to open App Home");
  logged.mockRestore();
});
