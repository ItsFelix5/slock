import type { PluginInfo } from "@slock/core";
import { getHost, service } from "@slock/core/solid";
import { confirmDialog, IconButton, Switch } from "@slock/ui";
import { Show } from "solid-js";

const STATUS_LABEL = {
  blocked: "Waiting for a dependency",
  failed: "Failed to start",
  off: "Off",
  running: "Running",
  starting: "Starting",
} as const;

async function toggle(plugin: PluginInfo, on: boolean) {
  const host = getHost();
  const running = plugin.dependents.filter(
    (id) => host.list().find((other) => other.id === id)?.status.state === "running",
  );
  if (!on && running.length > 0) {
    const confirmed = await confirmDialog({
      confirmLabel: "Turn off",
      danger: true,
      message: `${plugin.name} is needed by ${running.join(", ")}. Turn all off?`,
    });
    if (!confirmed) return;
  }
  if (!on) await Promise.all(running.map((id) => host.setEnabled(id, false)));
  await host.setEnabled(plugin.id, on);
}

export function PluginRow(props: { plugin: PluginInfo }) {
  const plugins = service("plugins");
  const removable = () => plugins.installed().includes(props.plugin.id);
  return (
    <div class="settings-row flex-between">
      <div>
        <div class="settings-row-label">{props.plugin.name}</div>
        <div class="settings-row-meta text-dim">
          {STATUS_LABEL[props.plugin.status.state]}
          <Show when={props.plugin.status.error}>{(message) => ` · ${message()}`}</Show>
        </div>
      </div>
      <div class="flex-align-center">
        <Show when={removable()}>
          <IconButton
            icon="trash"
            label="Remove"
            onClick={() => void plugins.remove(props.plugin.id)}
            size="sm"
            tone="dim"
          />
        </Show>
        <Switch checked={props.plugin.enabled} onChange={(on) => void toggle(props.plugin, on)} />
      </div>
    </div>
  );
}

export function ServerOnlyRow(props: { name: string }) {
  return (
    <div class="settings-row">
      <div class="settings-row-label">{props.name}</div>
    </div>
  );
}
