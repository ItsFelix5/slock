import type { PluginInfo } from "@slock/core";
import { getHost, service, usePoint } from "@slock/core/solid";
import { fuzzySearch, SegmentedControl } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, Show } from "solid-js";
import { groupByCategory } from "../data/categories";
import { PluginRow, ServerOnlyRow } from "./PluginRow";
import { PluginSettings } from "./PluginSettings";
import { UploadPlugin } from "./UploadPlugin";

type Filter = { label: string; matches: (plugin: PluginInfo) => boolean };

const ALL: Filter = { label: "All", matches: () => true };

const FILTERS: Filter[] = [
  ALL,
  { label: "On", matches: (plugin) => plugin.enabled },
  { label: "Off", matches: (plugin) => !plugin.enabled },
  {
    label: "Issues",
    matches: (plugin) => plugin.status.state === "failed" || plugin.status.state === "blocked",
  },
];

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
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal(ALL);
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
  const matching = () =>
    fuzzySearch(sorted().filter(filter().matches), {
      altText: (plugin) => `${plugin.category ?? ""} ${plugin.id}`,
      query: query(),
      text: (plugin) => plugin.name,
    });
  const uploaded = () => matching().filter((plugin) => plugins.installed().includes(plugin.id));
  const instance = () => matching().filter((plugin) => !plugins.installed().includes(plugin.id));
  const serverOnly = () =>
    fuzzySearch(filter() === ALL ? plugins.serverOnly() : [], {
      query: query(),
      text: (plugin) => plugin.name ?? plugin.id,
    });
  const nothingFound = () => matching().length === 0 && serverOnly().length === 0;

  return (
    <Show
      fallback={
        <>
          <h2>Plugins</h2>
          <div class="flex-align-center gap-sm">
            <input
              class="text-field"
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder="Find plugins"
              type="search"
              value={query()}
            />
            <SegmentedControl class="flex-shrink-0">
              <For each={FILTERS}>
                {(option) => (
                  <button
                    class={["segmented-control-btn", { active: filter() === option }]}
                    onClick={() => setFilter(option)}
                    type="button"
                  >
                    {option.label}
                  </button>
                )}
              </For>
            </SegmentedControl>
          </div>
          <Section onOpenSettings={setOpenId} plugins={uploaded()} title="User">
            <UploadPlugin />
          </Section>
          <For each={groupByCategory(instance())}>
            {(group) => (
              <Section onOpenSettings={setOpenId} plugins={group.plugins} title={group.title} />
            )}
          </For>
          <Show when={nothingFound()}>
            <p class="text-dim">No plugins found.</p>
          </Show>
          <Show when={serverOnly().length > 0}>
            <h3>Server only</h3>
            <div class="settings-section">
              <For each={serverOnly()}>
                {(plugin) => <ServerOnlyRow name={plugin.name ?? plugin.id} />}
              </For>
            </div>
          </Show>
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
