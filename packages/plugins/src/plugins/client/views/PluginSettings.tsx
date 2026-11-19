import { IconButton } from "@slock/ui";
import { Dynamic } from "@solidjs/web";
import type { PluginSettingsItem } from "../api";
import "./PluginSettings.css";

export function PluginSettings(props: {
  name: string;
  item: PluginSettingsItem;
  onBack: () => void;
}) {
  return (
    <>
      <div class="flex-align-center plugin-settings-header">
        <IconButton icon="arrow-left" label="Back" onClick={props.onBack} size="sm" tone="dim" />
        <h2>{props.name}</h2>
      </div>
      <Dynamic component={props.item.view} />
    </>
  );
}
