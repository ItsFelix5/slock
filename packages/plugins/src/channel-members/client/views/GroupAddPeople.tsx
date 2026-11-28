import { service } from "@slock/core/solid";
import GroupPeoplePicker, { groupChatSlots } from "@slock/plugins/dms/client/api/GroupPeoplePicker";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { ChannelId, UserId } from "@slock/types";
import { Button, type ComboboxOption, SegmentedControl } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";

const channelDetails = service("channel-details");
const conversations = service("conversations");
const dmsStore = service("dms");
const env = service("env");
const feedback = service("feedback");

const addingPeople = defineMutation<
  { channelId: ChannelId; historyStartTs?: string; userIds: UserId[] },
  ChannelId
>({
  key: ({ channelId }) => channelId,
  mode: "single",
  onError: (error, { channelId }) => feedback.caught(channelId, error, "Failed to add people."),
  onSuccess: (id) => {
    channelDetails.closeChannelDetails();
    conversations.setActiveView({ id, kind: "dm" });
  },
  run: ({ channelId, historyStartTs, userIds }) =>
    dmsStore.addGroupDmPeople(channelId, userIds, historyStartTs),
});

const HISTORY_CHOICES = [
  { key: "none", label: "None" },
  { key: "today", label: "Today" },
  { key: "all", label: "All" },
] as const;

type HistoryChoice = (typeof HISTORY_CHOICES)[number]["key"];

function historyStartTs(choice: HistoryChoice, now: number): string | undefined {
  if (choice === "none") return;
  if (choice === "all") return "0000000000.000001";
  return String(new Date(now).setHours(0, 0, 0, 0) / 1000);
}

export default function GroupAddPeople(props: { channelId: ChannelId; memberIds: UserId[] }) {
  const [people, setPeople] = createSignal<ComboboxOption<UserId>[]>([]);
  const [history, setHistory] = createSignal<HistoryChoice>("none");
  const adding = () => addingPeople.pending(props.channelId);

  const add = () =>
    addingPeople.run({
      channelId: props.channelId,
      historyStartTs: historyStartTs(history(), env.now()),
      userIds: people().map((person) => person.id),
    });

  return (
    <Show when={groupChatSlots(props.memberIds) > 0}>
      <div class="channel-details-add-people flex-col">
        <GroupPeoplePicker exclude={props.memberIds} onChange={setPeople} value={people()} />
        <Show when={people().length > 0}>
          <div class="flex-between">
            <div class="channel-details-history flex-align-center" role="group">
              <span class="field-label">Share history</span>
              <SegmentedControl>
                <For each={HISTORY_CHOICES}>
                  {(choice) => (
                    <button
                      class={["segmented-control-btn", { active: history() === choice.key }]}
                      onClick={() => setHistory(choice.key)}
                      type="button"
                    >
                      {choice.label}
                    </button>
                  )}
                </For>
              </SegmentedControl>
            </div>
            <Button disabled={adding()} onClick={add} size="sm" variant="primary">
              {adding() ? "Adding…" : "Add"}
            </Button>
          </div>
        </Show>
      </div>
    </Show>
  );
}
