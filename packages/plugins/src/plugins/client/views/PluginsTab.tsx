import type { PluginInfo } from "@slock/core";
import { getHost, service } from "@slock/core/solid";
import { For, type JSX, Show } from "solid-js";
import { PluginRow, ServerOnlyRow } from "./PluginRow";
import { UploadPlugin } from "./UploadPlugin";

function Section(props: { title: string; plugins: PluginInfo[]; children?: JSX.Element }) {
  return (
    <Show when={props.plugins.length > 0 || props.children}>
      <h3>{props.title}</h3>
      <div class="settings-section">
        <For each={props.plugins}>{(plugin) => <PluginRow plugin={plugin} />}</For>
        {props.children}
      </div>
    </Show>
  );
}

export default function PluginsTab() {
  const plugins = service("plugins");
  const sorted = () =>
    getHost()
      .list()
      .filter((plugin) => !plugin.hidden)
      .toSorted((a, b) => a.name.localeCompare(b.name));
  const uploaded = () => sorted().filter((plugin) => plugins.installed().includes(plugin.id));
  const core = () => sorted().filter((plugin) => plugin.core);
  const instance = () =>
    sorted().filter((plugin) => !(plugin.core || plugins.installed().includes(plugin.id)));

  return (
    <>
      <h2>Plugins</h2>
      <Section plugins={uploaded()} title="User">
        <UploadPlugin />
      </Section>
      <Section plugins={instance()} title="Instance" />
      <Show when={plugins.serverOnly().length > 0}>
        <h3>Server only</h3>
        <div class="settings-section">
          <For each={plugins.serverOnly()}>
            {(plugin) => <ServerOnlyRow name={plugin.name ?? plugin.id} />}
          </For>
        </div>
      </Show>
      <Section plugins={core()} title="Core" />
    </>
  );
}
