import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { provideUi } from "../../packages/ui/src/ui";
import { createFakeEnv, type FakeEnv } from "../support/core";

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
