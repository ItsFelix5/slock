import type { PluginInfo } from "@slock/core";
import { getHost, service, usePoint } from "@slock/core/solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { PluginRow, ServerOnlyRow } from "./PluginRow";
import { PluginSettings } from "./PluginSettings";
import { UploadPlugin } from "./UploadPlugin";

function Section(props: {
  title: string;
  plugins: PluginInfo[];
  onOpenSettings: (id: string) => void;
  children?: JSX.Element;
}) {
  return (
    <Show when={props.plugins.length > 0 || props.children}>
      <h3>{props.title}</h3>
      <div class="settings-section">
        <For each={props.plugins}>
          {(plugin) => <PluginRow onOpenSettings={props.onOpenSettings} plugin={plugin} />}
        </For>
        {props.children}
      </div>
    </Show>
  );
}

export default function PluginsTab() {
  const plugins = service("plugins");
  const settingsItems = usePoint("plugins.settings");
  const [openId, setOpenId] = createSignal<string>();
  const sorted = () =>
    getHost()
      .list()
      .filter((plugin) => !plugin.hidden)
      .toSorted((a, b) => a.name.localeCompare(b.name));
  const open = createMemo(() => {
    const item = settingsItems().find((candidate) => candidate.plugin === openId());
    const plugin = sorted().find((candidate) => candidate.id === openId());
    return item && plugin ? { item, name: plugin.name } : undefined;
  });
  const uploaded = () => sorted().filter((plugin) => plugins.installed().includes(plugin.id));
  const core = () => sorted().filter((plugin) => plugin.core);
  const instance = () =>
    sorted().filter((plugin) => !(plugin.core || plugins.installed().includes(plugin.id)));

  return (
    <Show
      fallback={
        <>
          <h2>Plugins</h2>
          <Section onOpenSettings={setOpenId} plugins={uploaded()} title="User">
            <UploadPlugin />
          </Section>
          <Section onOpenSettings={setOpenId} plugins={instance()} title="Instance" />
          <Show when={plugins.serverOnly().length > 0}>
            <h3>Server only</h3>
            <div class="settings-section">
              <For each={plugins.serverOnly()}>
                {(plugin) => <ServerOnlyRow name={plugin.name ?? plugin.id} />}
              </For>
            </div>
          </Show>
          <Section onOpenSettings={setOpenId} plugins={core()} title="Core" />
        </>
      }
      when={open()}
    >
      {(current) => (
        <PluginSettings
          item={current().item}
          name={current().name}
          onBack={() => setOpenId(undefined)}
        />
      )}
    </Show>
  );
}
