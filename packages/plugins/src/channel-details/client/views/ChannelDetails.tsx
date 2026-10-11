import { service, usePoint } from "@slock/core/solid";
import {
  Button,
  Icon,
  InlineFeedback,
  Overlay,
  PanelHeader,
  useEscapeClose,
  useTabStripShortcuts,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { channelIconName } from "../../../channels/client/api";
import type { ChannelDetailsTabItem } from "../api";
import type { ChannelDetailsTab } from "../channelDetails";
import ChannelAboutFields from "./ChannelAboutFields";
import ChannelCopyRows from "./ChannelCopyRows";
import "../api/ChannelDetails.css";
import {
  type EditableChannelDetails,
  editableChannelDetails,
  mergeChannelDetailsDraft,
} from "./fieldSave/channelDetailsDraft";

const channelDetails = service("channel-details");

const feedback = service("feedback");

const channelsStore = service("channels");
const usersStore = service("users");

function stripLeadingHash(name: string): string {
  return name.startsWith("#") ? name.slice(1) : name;
}

type TabEntry = {
  key: ChannelDetailsTab;
  label: string;
  item?: ChannelDetailsTabItem;
};

const ABOUT_TAB: TabEntry = { key: "about", label: "About" };

export default function ChannelDetails() {
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;
  const [tab, setTab] = createSignal<ChannelDetailsTab>("about");
  const [topicInput, setTopicInput] = createSignal("");
  const [purposeInput, setPurposeInput] = createSignal("");
  const [nameInput, setNameInput] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  useEscapeClose(channelDetails.closeChannelDetails, () => !!channelDetails.channelDetailsId());

  const detailsQuery = channelDetails.createChannelDetailsQuery(channelDetails.channelDetailsId);
  const details = () => detailsQuery.data;
  const refetch = () => detailsQuery.refetch();

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
    if (managerIds.isError) return false;
    return (managerIds.data ?? []).includes(me.id);
  });
  const tabItems = usePoint("channel-details.tab");
  const visibleTabs = createMemo<TabEntry[]>(() => [
    ABOUT_TAB,
    ...tabItems()
      .filter((item) => !item.managerOnly || isManager())
      .map((item) => ({ item, key: item.id, label: item.label })),
  ]);
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
    on(channelDetails.channelDetailsId, () => setTab(channelDetails.channelDetailsTab())),
  );
  createEffect(() => {
    if (activeTab()?.item?.managerOnly && !managerIds.isLoading && !isManager()) setTab("about");
  });

  let seededDetails: EditableChannelDetails | undefined;
  createEffect(
    on(details, (d) => {
      if (!d) return;
      const merged = mergeChannelDetailsDraft(
        { name: nameInput(), purpose: purposeInput(), topic: topicInput() },
        seededDetails,
        d,
      );
      setTopicInput(merged.topic);
      setPurposeInput(merged.purpose);
      setNameInput(merged.name);
      seededDetails = editableChannelDetails(d);
    }),
  );

  const nameDirty = () => {
    const d = details();
    return !!d && stripLeadingHash(nameInput().trim()) !== d.name;
  };
  const topicDirty = () => {
    const d = details();
    return !!d && topicInput().trim() !== d.topic;
  };
  const purposeDirty = () => {
    const d = details();
    return !!d && purposeInput().trim() !== d.purpose;
  };
  const anyDirty = () => nameDirty() || topicDirty() || purposeDirty();

  const discardChanges = () => {
    const d = details();
    if (!d) return;
    setNameInput(d.name);
    setTopicInput(d.topic);
    setPurposeInput(d.purpose);
  };

  const saveChanges = async () => {
    const id = channelDetails.channelDetailsId();
    const d = details();
    if (!(id && d) || saving()) return;

    const nextName = stripLeadingHash(nameInput().trim());
    if (!nextName) {
      setNameInput(d.name);
      feedback.flash(id, "Channel name can't be empty.", "error");
      return;
    }
    const nextTopic = topicInput().trim();
    const nextPurpose = purposeInput().trim();

    setSaving(true);
    const [nameOk, topicOk, purposeOk] = await Promise.all([
      nextName === d.name ? true : channelDetails.renameChannelById(id, nextName),
      nextTopic === d.topic ? true : channelDetails.updateChannelTopic(id, nextTopic),
      nextPurpose === d.purpose ? true : channelDetails.updateChannelPurpose(id, nextPurpose),
    ]);
    await Promise.resolve(refetch()).catch(() => {});
    setSaving(false);

    if (!nameOk) setNameInput(d.name);
    if (!topicOk) setTopicInput(d.topic);
    if (!purposeOk) setPurposeInput(d.purpose);
    if (nameOk && topicOk && purposeOk) feedback.flash(id, "Channel updated.");
  };

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
                  when={detailsQuery.isLoading}
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
                            aria-selected={tab() === t.key}
                            class="channel-details-tab btn-reset flex-align-center"
                            classList={{ active: tab() === t.key }}
                            onClick={() => setTab(t.key)}
                            ref={(el) => {
                              tabButtonRefs[i()] = el;
                            }}
                            role="tab"
                            tabIndex={tab() === t.key ? 0 : -1}
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
                      name={nameInput()}
                      onName={setNameInput}
                      onPurpose={setPurposeInput}
                      onTopic={setTopicInput}
                      purpose={purposeInput()}
                      saving={saving()}
                      topic={topicInput()}
                    />
                    <ChannelCopyRows details={d()} />
                  </Show>

                  <Show when={activeTab()?.item}>
                    {(item) => (
                      <Dynamic
                        archived={d().archived}
                        channelId={d().id}
                        channelName={d().name}
                        component={item().view}
                        memberCount={
                          d().memberCount ?? channelsStore.channelById(d().id)?.memberCount
                        }
                        private={d().private}
                        refetch={refetch}
                      />
                    )}
                  </Show>
                </div>

                <Show when={anyDirty()}>
                  <div class="channel-details-save-bar flex-align-center">
                    <span class="channel-details-save-hint text-dim">Unsaved changes</span>
                    <Button disabled={saving()} onClick={discardChanges} size="sm">
                      Discard
                    </Button>
                    <Button disabled={saving()} onClick={saveChanges} size="sm" variant="primary">
                      {saving() ? "Saving…" : "Save"}
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
