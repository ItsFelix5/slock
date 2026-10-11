import "./index.css";
import plugins from "virtual:plugins";
import { createHost, localEnabledStore } from "@slock/core";
import { Slot, setHost, solidReactive } from "@slock/core/solid";
import { render } from "solid-js/web";

const PLUGINS_KEY = "slock_plugins";

performance.mark("slock:boot");

if (new URLSearchParams(location.search).has("reset")) {
  localStorage.removeItem(PLUGINS_KEY);
  history.replaceState(null, "", location.pathname);
}

const host = createHost({
  enabled: localEnabledStore(PLUGINS_KEY),
  reactive: solidReactive,
});

setHost(host);
Object.assign(globalThis, { slockHost: host });
render(() => <Slot point="root" />, document.body);
void host.register(...plugins).then(() => performance.mark("slock:plugins-started"));
