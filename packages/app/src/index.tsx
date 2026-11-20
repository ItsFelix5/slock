import "./index.css";
import plugins from "virtual:plugins";
import { createHost, localEnabledStore } from "@slock/core";
import { Slot, setHost, solidReactive } from "@slock/core/solid";
import { render } from "@solidjs/web";

const enabled = localEnabledStore("slock_plugins");

performance.mark("slock:boot");

if (new URLSearchParams(location.search).has("reset")) {
  enabled.write({});
  history.replaceState(null, "", location.pathname);
}

const host = createHost({
  enabled,
  reactive: solidReactive,
});

setHost(host);
Object.assign(globalThis, { slock: host });
render(() => <Slot point="root" />, document.body);
void host.register(...plugins).then(() => performance.mark("slock:plugins-started"));
