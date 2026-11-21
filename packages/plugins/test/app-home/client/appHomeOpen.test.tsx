import { expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { ch, uid } from "@slock/slack/testing";
import { provideUi } from "@slock/ui";
import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import querySetup from "../../../src/query/client/index";

const BOT = uid("UBOT");
const A = ch("D1");
const B = ch("D2");

const settle = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
    flush();
  }
};

test("opening the home is dispatched again when the channel changes but the app does not", async () => {
  const warn = spyOn(console, "warn");
  const env = createFakeEnv(1, 1_000_000);
  const homeOf = () =>
    new Response(
      JSON.stringify({ appHome: { app_id: "A1", home_tab_enabled: true }, ok: true, view: null }),
    );
  env.fetch.respond(/app-home$/, homeOf);
  env.fetch.respond(/app-home\/open$/, () => new Response(JSON.stringify({ ok: true })));
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
    "../../../src/app-home/client/views/AppHomeTakeover"
  );
  const [id, setId] = createSignal(A);
  const root = document.createElement("div");
  const dispose = render(() => <AppHomeTakeover id={id()} kind="dm" />, root);
  await settle();
  setId(B);
  await settle();
  dispose();
  expect(warn).not.toHaveBeenCalled();
  const opens = env.fetch.calls.filter((call) => /app-home\/open$/.test(call.url));
  expect(opens.map((call) => call.url.split("/")[3])).toEqual([A, B]);
});
