import {
  Button,
  createCopyFeedback,
  Icon,
  InlineFeedback,
  listNavigationIndex,
  Overlay,
  PanelHeader,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createResource, createSignal, For, on, Show } from "solid-js";
import {
  type ChannelDetailsTab,
  channelDetailsId,
  channelDetailsTab,
  closeChannelDetails,
  loadChannelDetails,
  renameChannelById,
  updateChannelPurpose,
  updateChannelTopic,
} from "../../../lib/channelDetails";
import { channelIconName } from "../../../lib/displayName";
import { actionFeedback } from "../../../lib/feedback";
import { store } from "../../../lib/store";
import MrkdwnComposer from "../../composer/MrkdwnComposer";
import "./ChannelDetails.css";
import ChannelMembersTab from "./ChannelMembersTab";
import ChannelSettingsTab from "./ChannelSettingsTab";
import {
  type EditableChannelDetails,
  editableChannelDetails,
  mergeChannelDetailsDraft,
} from "./fieldSave/channelDetailsDraft";
import { saveEditableField } from "./fieldSave/fieldSaveController";

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
  const [savingName, setSavingName] = createSignal(false);
  const [savingTopic, setSavingTopic] = createSignal(false);
  const [savingPurpose, setSavingPurpose] = createSignal(false);

  useEscapeClose(closeChannelDetails, () => !!channelDetailsId());

  const [details, { refetch }] = createResource(channelDetailsId, loadChannelDetails);

  createEffect(on(channelDetailsId, () => setTab(channelDetailsTab())));

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

  const saveTopic = async () => {
    const id = channelDetailsId();
    const v = topicInput().trim();
    const previous = details()?.topic;
    if (!id || previous === undefined || v === previous || savingTopic()) return;
    await saveEditableField({
      next: v,
      persist: (next) => updateChannelTopic(id, next),
      previous,
      refresh: async () => {
        await Promise.resolve(refetch());
      },
      restore: setTopicInput,
      setPending: setSavingTopic,
    });
  };

  const savePurpose = async () => {
    const id = channelDetailsId();
    const v = purposeInput().trim();
    const previous = details()?.purpose;
    if (!id || previous === undefined || v === previous || savingPurpose()) return;
    await saveEditableField({
      next: v,
      persist: (next) => updateChannelPurpose(id, next),
      previous,
      refresh: async () => {
        await Promise.resolve(refetch());
      },
      restore: setPurposeInput,
      setPending: setSavingPurpose,
    });
  };

  const saveName = async () => {
    const id = channelDetailsId();
    const v = nameInput().trim().replace(LEADING_HASH_RE, "");
    const previous = details()?.name;
    if (!id || previous === undefined || v === previous || savingName()) return;
    if (!v) {
      // Unlike topic/purpose, an empty name isn't something Slack will accept -
      // revert instead of leaving the field cleared with nothing actually saved.
      setNameInput(previous);
      actionFeedback.flash(id, "Channel name can't be empty.", "error");
      return;
    }
    await saveEditableField({
      next: v,
      persist: (next) => renameChannelById(id, next),
      previous,
      refresh: async () => {
        await Promise.resolve(refetch());
      },
      restore: setNameInput,
      setPending: setSavingName,
    });
  };

  const [copiedKey, copy] = createCopyFeedback(1200, () => {
    const id = channelDetailsId();
    if (id) actionFeedback.flash(id, "Couldn't copy to the clipboard.", "error");
  });

  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") (e.currentTarget as HTMLElement).blur();
  };

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
          ariaLabel={details()?.name ? `Details for #${details()?.name}` : "Channel details"}
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
            when={details()}
          >
            {(d) => (
              <div class="channel-details-card flex-col">
                <PanelHeader
                  bottom={
                    <div class="channel-details-tabs" role="tablist">
                      <For each={TABS}>
                        {(t, i) => (
                          <button
                            aria-selected={tab() === t.key}
                            class="channel-details-tab btn-reset flex-align-center"
                            classList={{ active: tab() === t.key }}
                            onClick={() => setTab(t.key)}
                            onKeyDown={(e) => {
                              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                              e.preventDefault();
                              const next = listNavigationIndex(
                                e.key === "ArrowRight" ? "ArrowDown" : "ArrowUp",
                                i(),
                                TABS.length,
                                { wrap: true },
                              );
                              if (next === undefined) return;
                              setTab(TABS[next].key);
                              tabButtonRefs[next]?.focus();
                            }}
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
                    {d().name}
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
                          disabled={savingName()}
                          id="channel-details-name"
                          onBlur={saveName}
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
                        ariaBusy={savingTopic()}
                        disabled={savingTopic()}
                        id="channel-details-topic"
                        onBlur={saveTopic}
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
                        ariaBusy={savingPurpose()}
                        disabled={savingPurpose()}
                        id="channel-details-purpose"
                        multiline
                        onBlur={savePurpose}
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

                  <Show when={tab() === "settings"}>
                    <ChannelSettingsTab
                      archived={d().archived}
                      channelId={d().id}
                      creatorId={d().creatorId}
                      onChanged={refetch}
                      private={d().private}
                    />
                  </Show>
                </div>
              </div>
            )}
          </Show>
        </Overlay>
      )}
    </Show>
  );
}
