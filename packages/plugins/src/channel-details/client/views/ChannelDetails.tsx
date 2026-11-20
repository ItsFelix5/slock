import { service, usePoint } from "@slock/core/solid";
import { isWaiting } from "@slock/resource";
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
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { channelIconName } from "../../../channels/client/api";
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

type TabEntry = {
  key: ChannelDetailsTab;
  label: string;
  item?: ChannelDetailsTabItem;
};

const ABOUT_TAB: TabEntry = { key: "about", label: "About" };

export default function ChannelDetails() {
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;
  const [tab, setTab] = createSignal<ChannelDetailsTab>(() => {
    channelDetails.channelDetailsId();
    return channelDetails.channelDetailsTab();
  });

  useEscapeClose(channelDetails.closeChannelDetails, () => !!channelDetails.channelDetailsId());

  const detailsQuery = channelDetails.createChannelDetailsQuery(channelDetails.channelDetailsId);
  const details = () => detailsQuery().data;
  const refetch = () => {
    const id = channelDetails.channelDetailsId();
    if (id) void channelDetails.queries.details.refresh(id).catch(() => {});
  };

  const currentDetails = createMemo(() => {
    const d = details();
    const id = channelDetails.channelDetailsId();
    return d && id && d.id === id ? d : undefined;
  });

  const managerIds = channelDetails.createChannelManagerIdsQuery(channelDetails.channelDetailsId);
  const isManager = createMemo(() => {
    const me = usersStore.currentUser();
    if (!me) return false;
    if (me.isWorkspaceAdmin) return true;
    const creatorId = currentDetails()?.creatorId;
    if (creatorId && me.id === creatorId) return true;
    if (managerIds().error) return false;
    return (managerIds().data ?? []).includes(me.id);
  });
  const tabItems = usePoint("channel-details.tab");
  const visibleTabs = createMemo<TabEntry[]>(() => [
    ABOUT_TAB,
    ...tabItems()
      .filter((item) => !item.managerOnly || isManager())
      .map((item) => ({ item, key: item.id, label: item.label })),
  ]);
  const draft = createChannelDetailsDraft(details, refetch);
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

  createEffect(
    () => !!activeTab()?.item?.managerOnly && !isWaiting(managerIds()) && !isManager(),
    (locked) => {
      if (locked) setTab("about");
    },
  );

  return (
    <Show when={channelDetails.channelDetailsId()}>
      {(id) => (
        <Overlay
          ariaLabel={
            currentDetails()?.name ? `Details for #${currentDetails()?.name}` : "Channel details"
          }
          onClose={channelDetails.closeChannelDetails}
        >
          <Show
            fallback={
              <div class="channel-details-card modal-card">
                <PanelHeader onClose={channelDetails.closeChannelDetails} title="Channel details" />
                <Show
                  fallback={
                    <div class="channel-details-load-error flex-center flex-col">
                      <span>Couldn't load channel details.</span>
                      <InlineFeedback feedback={feedback.get(id())} priority={2} />
                      <Button onClick={() => refetch()} size="sm">
                        Try again
                      </Button>
                    </div>
                  }
                  when={isWaiting(detailsQuery())}
                >
                  <div class="channel-details-loading flex-center text-dim text-sm">
                    Loading channel details…
                  </div>
                </Show>
              </div>
            }
            when={currentDetails()}
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
                              tabButtonRefs[i()] = el;
                            }}
                            role="tab"
                            tabindex={tab() === t.key ? 0 : -1}
                            type="button"
                          >
                            {t.label}
                            <Show when={t.item?.count?.(d())}>
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
                    <Icon name={channelIconName(d().private, d().archived)} size={14} />
                    <span class="truncate">{d().name}</span>
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
                      name={draft.name()}
                      onName={draft.setName}
                      onPurpose={draft.setPurpose}
                      onTopic={draft.setTopic}
                      purpose={draft.purpose()}
                      saving={draft.saving()}
                      topic={draft.topic()}
                    />
                    <ChannelCopyRows details={d()} />
                  </Show>

                  <Show when={activeTab()?.item}>
                    <ActiveTabView
                      archived={d().archived}
                      channelId={d().id}
                      channelName={d().name}
                      memberCount={
                        d().memberCount ?? channelsStore.channelById(d().id)?.memberCount
                      }
                      private={d().private}
                      refetch={refetch}
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
