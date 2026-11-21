import "./index.css";
import { createHost, localEnabledStore, type PluginDef } from "@slock/core";
import { Slot, setHost, solidReactive } from "@slock/core/solid";
import { render } from "@solidjs/web";

const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export function boot(plugins: PluginDef[]) {
  const enabled = localEnabledStore("slock_plugins");

  performance.mark("slock:boot");

  if (new URLSearchParams(location.search).has("reset")) {
    enabled.write({});
    history.replaceState(null, "", location.pathname);
  }

  const host = createHost({ enabled, reactive: solidReactive });

  setHost(host);
  Object.assign(globalThis, { slock: host });
  render(() => <Slot point="root" />, document.body);
  const eager = plugins.filter((def) => "setup" in def);
  const lazy = plugins.filter((def) => "load" in def);
  void host
    .register(...eager)
    .then(() => performance.mark("slock:plugins-started"))
    .then(nextPaint)
    .then(() => host.register(...lazy));
}
