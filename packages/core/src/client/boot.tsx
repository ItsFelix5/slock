import { createHost, type PluginDef } from "@slock/core";
import { Slot, setHost, solidReactive } from "@slock/core/solid";
import { render } from "@solidjs/web";
import { browserEnv } from "./browserEnv";
import { localEnabledStore } from "./enabledStore";

export async function boot(plugins: PluginDef[]) {
  const enabled = localEnabledStore("slock_plugins");

  performance.mark("slock:boot");

  if (new URLSearchParams(location.search).has("reset")) {
    enabled.write({});
    history.replaceState(null, "", location.pathname);
  }

  const host = createHost({ enabled, env: browserEnv, reactive: solidReactive });

  setHost(host);
  Object.assign(globalThis, { slock: host });
  await host.register(...plugins.filter((def) => "setup" in def));
  performance.mark("slock:plugins-started");
  render(() => <Slot point="root" />, document.body);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await host.register(...plugins.filter((def) => "load" in def));
}
