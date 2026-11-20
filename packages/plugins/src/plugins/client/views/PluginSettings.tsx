import { IconButton } from "@slock/ui";
import { dynamic } from "@solidjs/web";
import type { PluginSettingsItem } from "../api";
import "./PluginSettings.css";

export function PluginSettings(props: {
  name: string;
  item: PluginSettingsItem;
  onBack: () => void;
}) {
  const View = dynamic(() => props.item.view);
  return (
    <>
      <div class="flex-align-center plugin-settings-header">
        <IconButton icon="arrow-left" label="Back" onClick={props.onBack} size="sm" tone="dim" />
        <h2>{props.name}</h2>
      </div>
      <View />
    </>
  );
}
