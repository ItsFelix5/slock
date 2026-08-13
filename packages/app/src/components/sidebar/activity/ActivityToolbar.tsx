import { Icon, Tooltip } from "@slock/ui";
import { For, Show } from "solid-js";
import { READ_STATES, type ReadState, TAG_FILTERS, type Tag } from "./activityViewFilters";

export default function ActivityToolbar(props: {
  keyword: string;
  onKeywordInput: (value: string) => void;
  readState: ReadState;
  onReadStateChange: (state: ReadState) => void;
  tabCount: (key: ReadState) => number | undefined;
  selectedTag: Tag | "all";
  onSelectTag: (tag: Tag | "all") => void;
}) {
  return (
    <div class="activity-toolbar">
      <div class="activity-search-wrap flex-align-center">
        <Icon name="search" size={15} />
        <input
          class="activity-search"
          onInput={(event) => props.onKeywordInput(event.currentTarget.value)}
          placeholder="Search activity"
          type="search"
          value={props.keyword}
        />
      </div>

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
          <Tooltip content="All activity">
            <button
              aria-label="All activity"
              aria-pressed={props.selectedTag === "all"}
              class="activity-type-button btn-reset flex-center"
              classList={{ active: props.selectedTag === "all" }}
              onClick={() => props.onSelectTag("all")}
              type="button"
            >
              <Icon name="list-view" size={17} />
            </button>
          </Tooltip>
          <For each={TAG_FILTERS}>
            {(filter) => (
              <Tooltip content={filter.label}>
                <button
                  aria-label={filter.label}
                  aria-pressed={props.selectedTag === filter.key}
                  class="activity-type-button btn-reset flex-center"
                  classList={{ active: props.selectedTag === filter.key }}
                  onClick={() => props.onSelectTag(filter.key)}
                  type="button"
                >
                  <Icon name={filter.icon} size={17} />
                </button>
              </Tooltip>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
