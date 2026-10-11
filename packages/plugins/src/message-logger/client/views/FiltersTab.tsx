import { Switch } from "@slock/ui";
import type { LogFilters } from "../filters";

export default function FiltersTab(props: { filters: LogFilters }) {
  return (
    <>
      <h2>Message logger</h2>
      <div class="settings-row flex-between">
        <div class="settings-row-label">Ignore my messages</div>
        <Switch checked={props.filters.ignoreSelf()} onChange={props.filters.setIgnoreSelf} />
      </div>
      <div class="settings-row flex-between">
        <div class="settings-row-label">Ignore bots</div>
        <Switch checked={props.filters.ignoreBots()} onChange={props.filters.setIgnoreBots} />
      </div>
      <div class="settings-section">
        <div class="settings-row-label">Ignored user IDs</div>
        <input
          aria-label="Ignored user IDs"
          class="settings-status-input text-field"
          onChange={(e) => props.filters.setIgnoredUsers(e.currentTarget.value)}
          placeholder="U123, U456"
          spellcheck={false}
          type="text"
          value={props.filters.ignoredUsers()}
        />
      </div>
    </>
  );
}
