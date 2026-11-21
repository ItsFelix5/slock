import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, type FakeEnv } from "@slock/core/testing";
import { provideUi } from "../src/ui";

export async function startFakeEnv(): Promise<{
  env: FakeEnv;
  restart: () => Promise<void>;
  stop: () => void;
}> {
  const env = createFakeEnv();
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register({ id: "ui", setup: provideUi });
  return { env, restart: () => host.restart(), stop: () => host.stop() };
}
