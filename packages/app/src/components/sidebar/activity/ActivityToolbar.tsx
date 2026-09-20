import { IconButton } from "@slock/ui";
import { For, Show } from "solid-js";
import { READ_STATES, type ReadState, TAG_FILTERS, type Tag } from "./activityViewFilters";

export default function ActivityToolbar(props: {
  readState: ReadState;
  onReadStateChange: (state: ReadState) => void;
  tabCount: (key: ReadState) => number | undefined;
  selectedTag: Tag | "all";
  onSelectTag: (tag: Tag | "all") => void;
}) {
  return (
    <div class="activity-toolbar">
      <div aria-label="Activity status" class="activity-read-toggle">
        <For each={READ_STATES}>
          {(state) => {
            const count = () => props.tabCount(state.key);
            return (
              <button
                aria-selected={props.readState === state.key}
                class="btn-reset"
                classList={{ active: props.readState === state.key }}
                onClick={() => props.onReadStateChange(state.key)}
                type="button"
              >
                {state.label}
                <Show when={(count() ?? 0) > 0}>
                  <span>{count()}</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      <div class="activity-type-filter">
        <div aria-label="Activity type" class="activity-type-icons">
          <IconButton
            active={props.selectedTag === "all"}
            aria-pressed={props.selectedTag === "all"}
            class="activity-type-button"
            icon="list-view"
            iconSize={17}
            label="All activity"
            onClick={() => props.onSelectTag("all")}
          />
          <For each={TAG_FILTERS}>
            {(filter) => (
              <IconButton
                active={props.selectedTag === filter.key}
                aria-pressed={props.selectedTag === filter.key}
                class="activity-type-button"
                icon={filter.icon}
                iconSize={17}
                label={filter.label}
                onClick={() => props.onSelectTag(filter.key)}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
