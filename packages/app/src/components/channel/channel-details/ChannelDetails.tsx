import {
  Button,
  blurOnEnter,
  createCopyFeedback,
  Icon,
  InlineFeedback,
  Overlay,
  PanelHeader,
  tabStripKeyDown,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createResource, createSignal, For, on, Show } from "solid-js";
import { channelIconName } from "../../../lib/displayName";
import { actionFeedback } from "../../../lib/feedback";
import { store } from "../../../lib/store";
import MrkdwnComposer from "../../composer/MrkdwnComposer";
import {
  type ChannelDetailsTab,
  channelDetailsId,
  channelDetailsTab,
  closeChannelDetails,
  loadChannelDetails,
  loadChannelManagerIds,
  renameChannelById,
  updateChannelPurpose,
  updateChannelTopic,
} from "../lib/channelDetails";
import "./ChannelDetails.css";
import ChannelMembersTab from "./ChannelMembersTab";
import ChannelSettingsTab from "./ChannelSettingsTab";
import {
  type EditableChannelDetails,
  editableChannelDetails,
  mergeChannelDetailsDraft,
} from "./fieldSave/channelDetailsDraft";

const LEADING_HASH_RE = /^#/;

const TABS: { key: ChannelDetailsTab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "members", label: "Members" },
  { key: "settings", label: "Settings" },
];

export default function ChannelDetails() {
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  const [tab, setTab] = createSignal<ChannelDetailsTab>("about");
  const [topicInput, setTopicInput] = createSignal("");
  const [purposeInput, setPurposeInput] = createSignal("");
  const [nameInput, setNameInput] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  useEscapeClose(closeChannelDetails, () => !!channelDetailsId());

  const [details, { refetch }] = createResource(channelDetailsId, loadChannelDetails);

  const currentDetails = createMemo(() => {
    const d = details();
    const id = channelDetailsId();
    return d && id && d.id === id ? d : undefined;
  });

  const [managerIds] = createResource(channelDetailsId, loadChannelManagerIds);
  const isManager = createMemo(() => {
    const me = store.users.currentUser();
    if (!me) return false;
    if (me.isWorkspaceAdmin) return true;
    const creatorId = currentDetails()?.creatorId;
    if (creatorId && me.id === creatorId) return true;
    if (managerIds.error) return false;
    return (managerIds() ?? []).includes(me.id);
  });
  const visibleTabs = () => TABS.filter((t) => t.key !== "settings" || isManager());

  createEffect(on(channelDetailsId, () => setTab(channelDetailsTab())));
  createEffect(() => {
    if (tab() === "settings" && !managerIds.loading && !isManager()) setTab("about");
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
    return !!d && nameInput().trim().replace(LEADING_HASH_RE, "") !== d.name;
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
    const id = channelDetailsId();
    const d = details();
    if (!(id && d) || saving()) return;

    const nextName = nameInput().trim().replace(LEADING_HASH_RE, "");
    if (!nextName) {
      setNameInput(d.name);
      actionFeedback.flash(id, "Channel name can't be empty.", "error");
      return;
    }
    const nextTopic = topicInput().trim();
    const nextPurpose = purposeInput().trim();

    setSaving(true);
    const [nameOk, topicOk, purposeOk] = await Promise.all([
      nextName === d.name ? true : renameChannelById(id, nextName),
      nextTopic === d.topic ? true : updateChannelTopic(id, nextTopic),
      nextPurpose === d.purpose ? true : updateChannelPurpose(id, nextPurpose),
    ]);
    await Promise.resolve(refetch()).catch(() => {});
    setSaving(false);

    if (!nameOk) setNameInput(d.name);
    if (!topicOk) setTopicInput(d.topic);
    if (!purposeOk) setPurposeInput(d.purpose);
    if (nameOk && topicOk && purposeOk) actionFeedback.flash(id, "Channel updated.");
  };

  const [copiedKey, copy] = createCopyFeedback(1200, () => {
    const id = channelDetailsId();
    if (id) actionFeedback.flash(id, "Couldn't copy to the clipboard.", "error");
  });

  const createdLine = createMemo(() => {
    const d = details();
    if (!d?.created) return null;
    const date = new Date(d.created * 1000).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const creator = d.creatorId ? store.users.userById(d.creatorId)?.name : undefined;
    return creator ? `Created by ${creator} on ${date}` : `Created on ${date}`;
  });

  return (
    <Show when={channelDetailsId()}>
      {(id) => (
        <Overlay
          ariaLabel={
            currentDetails()?.name ? `Details for #${currentDetails()?.name}` : "Channel details"
          }
          onClose={closeChannelDetails}
        >
          <Show
            fallback={
              <div class="channel-details-card flex-col">
                <PanelHeader onClose={closeChannelDetails} title="Channel details" />
                <Show
                  fallback={
                    <div class="channel-details-load-error flex-center flex-col">
                      <span>Couldn't load channel details.</span>
                      <InlineFeedback feedback={actionFeedback.get(id())} priority={2} />
                      <Button onClick={() => refetch()} size="sm">
                        Try again
                      </Button>
                    </div>
                  }
                  when={details.loading}
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
              <div class="channel-details-card flex-col">
                <PanelHeader
                  bottom={
                    <div class="channel-details-tabs" role="tablist">
                      <For each={visibleTabs()}>
                        {(t, i) => (
                          <button
                            aria-selected={tab() === t.key}
                            class="channel-details-tab btn-reset flex-align-center"
                            classList={{ active: tab() === t.key }}
                            onClick={() => setTab(t.key)}
                            onKeyDown={(e) =>
                              tabStripKeyDown(e, visibleTabs(), i(), (next, nextIndex) => {
                                setTab(next.key);
                                tabButtonRefs[nextIndex]?.focus();
                              })
                            }
                            ref={(el) => {
                              tabButtonRefs[i()] = el;
                            }}
                            role="tab"
                            tabIndex={tab() === t.key ? 0 : -1}
                            type="button"
                          >
                            {t.label}
                            <Show when={t.key === "members" && d().memberCount}>
                              {(count) => <span class="channel-details-tab-count">{count()}</span>}
                            </Show>
                          </button>
                        )}
                      </For>
                    </div>
                  }
                  onClose={closeChannelDetails}
                >
                  <div class="channel-details-title">
                    <Icon name={channelIconName(d().private)} size={14} />
                    <span>{d().name}</span>
                  </div>
                </PanelHeader>

                <InlineFeedback
                  class="channel-details-feedback"
                  feedback={actionFeedback.get(d().id)}
                  priority={2}
                />

                <div class="channel-details-body flex-col">
                  <Show when={tab() === "about"}>
                    <div class="channel-details-field flex-col">
                      <label class="channel-details-label" for="channel-details-name">
                        Channel name
                      </label>
                      <div class="channel-details-name-wrap flex-align-center">
                        <span class="channel-details-name-prefix flex-align-center">
                          <Icon name={channelIconName(d().private)} size={13} />
                        </span>
                        <input
                          class="channel-details-input"
                          disabled={saving()}
                          id="channel-details-name"
                          onInput={(e) => setNameInput(e.currentTarget.value)}
                          onKeyDown={blurOnEnter}
                          type="text"
                          value={nameInput()}
                        />
                      </div>
                    </div>
                    <div class="channel-details-field flex-col">
                      <label class="channel-details-label" for="channel-details-topic">
                        Topic
                      </label>
                      <MrkdwnComposer
                        ariaLabel="Topic"
                        ariaBusy={saving()}
                        channelId={d().id}
                        disabled={saving()}
                        id="channel-details-topic"
                        onInput={setTopicInput}
                        placeholder="Add a topic"
                        value={topicInput()}
                      />
                    </div>
                    <div class="channel-details-field flex-col">
                      <label class="channel-details-label" for="channel-details-purpose">
                        Description
                      </label>
                      <MrkdwnComposer
                        ariaLabel="Description"
                        ariaBusy={saving()}
                        channelId={d().id}
                        disabled={saving()}
                        id="channel-details-purpose"
                        multiline
                        onInput={setPurposeInput}
                        placeholder="Add a description"
                        value={purposeInput()}
                      />
                    </div>
                    <Show when={createdLine()}>
                      <p class="channel-details-meta">{createdLine()}</p>
                    </Show>
                    <div class="channel-details-copy-list flex-col">
                      <Show when={d().email}>
                        {(email) => (
                          <button
                            class="channel-details-copy-row btn-reset flex-align-center"
                            onClick={() => copy(email(), "email")}
                            type="button"
                          >
                            <Icon name="email-filled" size={15} />
                            <span class="channel-details-copy-value truncate">{email()}</span>
                            <Icon name={copiedKey() === "email" ? "check" : "copy"} size={14} />
                          </button>
                        )}
                      </Show>
                      <button
                        class="channel-details-copy-row btn-reset flex-align-center"
                        onClick={() => copy(`${location.origin}/#${d().id}`, "link")}
                        type="button"
                      >
                        <Icon name="link" size={15} />
                        <span class="channel-details-copy-value truncate">
                          Copy link to channel
                        </span>
                        <Icon name={copiedKey() === "link" ? "check" : "copy"} size={14} />
                      </button>
                      <button
                        class="channel-details-copy-row btn-reset flex-align-center"
                        onClick={() => copy(d().id, "id")}
                        type="button"
                      >
                        <Icon name="info" size={15} />
                        <span class="channel-details-copy-value truncate">
                          Channel ID: {d().id}
                        </span>
                        <Icon name={copiedKey() === "id" ? "check" : "copy"} size={14} />
                      </button>
                    </div>
                  </Show>

                  <Show when={tab() === "members"}>
                    <ChannelMembersTab
                      channelId={d().id}
                      channelName={d().name}
                      onMembersChanged={refetch}
                    />
                  </Show>

                  <Show when={tab() === "settings" && isManager()}>
                    <ChannelSettingsTab
                      archived={d().archived}
                      channelId={d().id}
                      onChanged={refetch}
                      private={d().private}
                    />
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
