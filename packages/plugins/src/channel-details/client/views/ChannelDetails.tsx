import { Slot, service, usePoint } from "@slock/core/solid";
import { channelIconName } from "@slock/plugins/channels/client/api";
import { conversationView } from "@slock/plugins/slack/client/api";
import { isWaiting } from "@slock/resource";
import type { ChannelId, ChannelDetails as Details } from "@slock/types";
import {
  ariaBoolean,
  Button,
  Icon,
  InlineFeedback,
  Overlay,
  PanelHeader,
  useEscapeClose,
  useTabStripShortcuts,
} from "@slock/ui";
import { dynamic } from "@solidjs/web";
import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import type { ChannelDetailsTabItem } from "../api";
import type { ChannelDetailsTab } from "../channelDetails";
import ChannelAboutFields from "./ChannelAboutFields";
import ChannelCopyRows from "./ChannelCopyRows";
import "../api/ChannelDetails.css";
import { createChannelDetailsDraft } from "./createChannelDetailsDraft";

const channelDetails = service("channel-details");

const feedback = service("feedback");

const channelsStore = service("channels");
const usersStore = service("users");
const dmsStore = service("dms");
const titles = service("titles");

type TabEntry = {
  key: ChannelDetailsTab;
  label: string;
  item?: ChannelDetailsTabItem;
};

const ABOUT_TAB: TabEntry = { key: "about", label: "About" };

const refresh = (id: ChannelId) =>
  Promise.all([
    channelsStore.refreshChannelTopic(id),
    conversationView.refresh(id).catch(() => undefined),
  ]);

function flashFailure(error: () => unknown, message: string) {
  createEffect(error, (failure) => {
    const id = untrack(channelDetails.channelDetailsId);
    if (failure && id) feedback.caught(id, failure, message);
  });
}

export default function ChannelDetails() {
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;
  const [requestedTab, setTab] = createSignal<ChannelDetailsTab>(() => {
    channelDetails.channelDetailsId();
    return channelDetails.channelDetailsTab();
  });

  const groupChat = createMemo(() => {
    const id = channelDetails.channelDetailsId();
    return !!id && dmsStore.isGroupDm(id);
  });
  const heading = () => (groupChat() ? "Group chat details" : "Channel details");

  useEscapeClose(channelDetails.closeChannelDetails, () => !!channelDetails.channelDetailsId());

  const view = conversationView.state(() => channelDetails.channelDetailsId() ?? undefined);
  const details = () => view().data?.details;
  flashFailure(() => view().error, "Failed to load channel details.");

  const managers = channelsStore.channelManagersState(() =>
    groupChat() ? undefined : (channelDetails.channelDetailsId() ?? undefined),
  );
  flashFailure(() => managers().error, "Failed to load channel managers.");
  const isManager = createMemo(() => {
    const me = usersStore.currentUser();
    if (!me) return false;
    if (me.isWorkspaceAdmin) return true;
    const creatorId = details()?.creatorId;
    if (creatorId && me.id === creatorId) return true;
    return !!managers().data?.has(me.id);
  });
  const tabItems = usePoint("channel-details.tab");
  const visibleTabs = createMemo<TabEntry[]>(() => [
    ABOUT_TAB,
    ...tabItems()
      .filter((item) => {
        if (item.audience === "groupChat") return groupChat();
        return item.audience !== "channelManagers" || (!groupChat() && isManager());
      })
      .map((item) => ({ item, key: item.id, label: item.label })),
  ]);
  const draft = createChannelDetailsDraft(details, refresh, groupChat);
  const tab = createMemo<ChannelDetailsTab>(() => {
    const wanted = requestedTab();
    if (visibleTabs().some((entry) => entry.key === wanted)) return wanted;
    const awaitingManagers =
      !groupChat() &&
      isWaiting(managers()) &&
      tabItems().find((item) => item.id === wanted)?.audience === "channelManagers";
    return awaitingManagers ? wanted : "about";
  });
  const ActiveTabView = dynamic(() => activeTab()?.item?.view);
  const activeTab = () => visibleTabs().find((entry) => entry.key === tab());
  useTabStripShortcuts({
    activate: (next, nextIndex) => {
      setTab(next.key);
      tabButtonRefs[nextIndex]?.focus();
    },
    items: visibleTabs,
    root: () => tabListRef,
  });

  const nameOf = (d: Details) => (groupChat() ? titles.title(d.id) : d.name);
  const memberCount = (d: Details) => {
    const others = dmsStore.dmById(d.id)?.memberIds;
    return others ? others.length + 1 : channelsStore.channelById(d.id)?.memberCount;
  };
  const openChannelId = createMemo(() => {
    const id = channelDetails.channelDetailsId();
    return id && !dmsStore.dmById(id) ? id : undefined;
  });
  createEffect(openChannelId, (id) => {
    if (id) void channelsStore.refreshChannelTopic(id);
  });
  const label = () => {
    const name = details()?.name;
    return !groupChat() && name ? `Details for #${name}` : heading();
  };

  return (
    <Show when={channelDetails.channelDetailsId()}>
      {(id) => (
        <Overlay ariaLabel={label()} onClose={channelDetails.closeChannelDetails}>
          <Show
            fallback={
              <div class="channel-details-card modal-card">
                <PanelHeader onClose={channelDetails.closeChannelDetails} title={heading()} />
                <Show
                  fallback={
                    <div class="channel-details-load-error flex-center flex-col">
                      <span>Couldn't load details.</span>
                      <InlineFeedback feedback={feedback.get(id())} priority={2} />
                      <Button onClick={() => void refresh(id())} size="sm">
                        Try again
                      </Button>
                    </div>
                  }
                  when={isWaiting(view())}
                >
                  <div class="channel-details-loading flex-center text-dim text-sm">
                    Loading details…
                  </div>
                </Show>
              </div>
            }
            when={details()}
          >
            {(d) => (
              <div class="channel-details-card modal-card">
                <PanelHeader
                  bottom={
                    <div class="channel-details-tabs" ref={tabListRef} role="tablist">
                      <For each={visibleTabs()}>
                        {(t, i) => (
                          <button
                            aria-selected={ariaBoolean(tab() === t.key)}
                            class={[
                              "channel-details-tab btn-reset flex-align-center",
                              { active: tab() === t.key },
                            ]}
                            onClick={() => setTab(t.key)}
                            ref={(el) => {
                              tabButtonRefs[untrack(i)] = el;
                            }}
                            role="tab"
                            tabindex={tab() === t.key ? 0 : -1}
                            type="button"
                          >
                            {t.label}
                            <Show when={t.item?.count?.({ memberCount: memberCount(d()) })}>
                              {(count) => <span class="channel-details-tab-count">{count()}</span>}
                            </Show>
                          </button>
                        )}
                      </For>
                    </div>
                  }
                  onClose={channelDetails.closeChannelDetails}
                >
                  <div class="channel-details-title flex-align-center">
                    <Show
                      fallback={
                        <Icon name={channelIconName(d().private, d().archived)} size={14} />
                      }
                      when={groupChat()}
                    >
                      <Slot id={d().id} kind="dm" point="messages.titleIcon" />
                    </Show>
                    <span class="truncate">{nameOf(d())}</span>
                  </div>
                </PanelHeader>

                <InlineFeedback
                  class="channel-details-feedback truncate"
                  feedback={feedback.get(d().id)}
                  priority={2}
                />

                <div class="channel-details-body flex-col">
                  <Show when={tab() === "about"}>
                    <ChannelAboutFields
                      details={d()}
                      groupChat={groupChat()}
                      name={draft.name()}
                      onName={draft.setName}
                      onPurpose={draft.setPurpose}
                      onTopic={draft.setTopic}
                      purpose={draft.purpose()}
                      saving={draft.saving()}
                      topic={draft.topic()}
                    />
                    <ChannelCopyRows details={d()} groupChat={groupChat()} />
                  </Show>

                  <Show when={activeTab()?.item}>
                    <ActiveTabView
                      archived={d().archived}
                      channelId={d().id}
                      channelName={nameOf(d())}
                      groupChat={groupChat()}
                      memberCount={memberCount(d())}
                      private={d().private}
                      refetch={() => void refresh(d().id)}
                    />
                  </Show>
                </div>

                <Show when={draft.anyDirty()}>
                  <div class="channel-details-save-bar flex-align-center">
                    <span class="channel-details-save-hint text-dim">Unsaved changes</span>
                    <Button disabled={draft.saving()} onClick={draft.discardChanges} size="sm">
                      Discard
                    </Button>
                    <Button
                      disabled={draft.saving()}
                      onClick={draft.saveChanges}
                      size="sm"
                      variant="primary"
                    >
                      {draft.saving() ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </Overlay>
      )}
    </Show>
  );
}
