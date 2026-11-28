import { type Context, defined } from "@slock/core";
import { createLocalPref } from "@slock/plugins/slack/client/api/localPref";
import { Switch } from "@slock/ui";
import { For } from "solid-js";

type SwitchSetting = { default: boolean; label: string };

export function definePluginSettings<Fields extends Record<string, SwitchSetting>>(
  ctx: Context,
  fields: Fields,
) {
  const rows = Object.entries(fields).map(([key, field]) => {
    const [value, setValue] = createLocalPref(`${ctx.id}.${key}`, field.default);
    return { key, label: field.label, setValue, value };
  });
  const valueByKey = new Map(rows.map((row) => [row.key, row.value]));

  ctx.add("plugins.settings", {
    plugin: ctx.id,
    view: () => (
      <For each={rows}>
        {(row) => (
          <div class="settings-row flex-between">
            <div class="settings-row-label">{row.label}</div>
            <Switch checked={row.value()} onChange={row.setValue} />
          </div>
        )}
      </For>
    ),
  });

  return (key: keyof Fields & string) => defined(valueByKey.get(key));
}
