// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to the save operation.
import {
  Button,
  createCopyFeedback,
  Icon,
  InlineFeedback,
  Overlay,
  PanelHeader,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createResource, createSignal, For, on, Show } from "solid-js";
import {
  channelDetailsId,
  closeChannelDetails,
  loadChannelDetails,
  renameChannelById,
  updateChannelPurpose,
  updateChannelTopic,
} from "../../../lib/channelDetails";
import { actionFeedback, store } from "../../../lib/store";
import ChannelMembersTab from "./ChannelMembersTab";
import "./ChannelDetails.css";
import ChannelSettingsTab from "./ChannelSettingsTab";
import {
  type EditableChannelDetails,
  editableChannelDetails,
  mergeChannelDetailsDraft,
} from "./fieldSave/channelDetailsDraft";
import { saveEditableField } from "./fieldSave/fieldSaveController";

type Tab = "about" | "members" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "members", label: "Members" },
  { key: "settings", label: "Settings" },
];

export default function ChannelDetails() {
  const [tab, setTab] = createSignal<Tab>("about");
  const [topicInput, setTopicInput] = createSignal("");
  const [purposeInput, setPurposeInput] = createSignal("");
  const [nameInput, setNameInput] = createSignal("");
  const [savingName, setSavingName] = createSignal(false);
  const [savingTopic, setSavingTopic] = createSignal(false);
  const [savingPurpose, setSavingPurpose] = createSignal(false);

  useEscapeClose(closeChannelDetails, () => !!channelDetailsId());

  const [details, { refetch }] = createResource(channelDetailsId, loadChannelDetails);

  createEffect(on(channelDetailsId, () => setTab("about")));

  // Refreshes after one field saves must not erase unsaved typing in another.
  // Track the last server snapshot and only replace fields still equal to it.
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
    const v = nameInput().trim().replace(/^#/, "");
    const previous = details()?.name;
    if (!(id && v) || previous === undefined || v === previous || savingName()) return;
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
    if (id) actionFeedback.flash(id, "Couldn’t copy to the clipboard.", "error");
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
                    <div class="channel-details-load-error flex-center flex-col" role="alert">
                      <span>Couldn’t load channel details.</span>
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
                <PanelHeader onClose={closeChannelDetails}>
                  <div class="channel-details-title">
                    {d().private ? <Icon name="lock" size={14} /> : "#"}
                    {d().name}
                  </div>
                </PanelHeader>
                <div class="channel-details-tabs">
                  <For each={TABS}>
                    {(t) => (
                      <button
                        aria-pressed={tab() === t.key}
                        class="channel-details-tab btn-reset flex-align-center"
                        classList={{ active: tab() === t.key }}
                        onClick={() => setTab(t.key)}
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
                          {d().private ? <Icon name="lock" size={13} /> : "#"}
                        </span>
                        <input
                          aria-busy={savingName()}
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
                      <input
                        aria-busy={savingTopic()}
                        class="channel-details-input"
                        disabled={savingTopic()}
                        id="channel-details-topic"
                        onBlur={saveTopic}
                        onInput={(e) => setTopicInput(e.currentTarget.value)}
                        onKeyDown={blurOnEnter}
                        placeholder="Add a topic"
                        type="text"
                        value={topicInput()}
                      />
                    </div>
                    <div class="channel-details-field flex-col">
                      <label class="channel-details-label" for="channel-details-purpose">
                        Description
                      </label>
                      <textarea
                        aria-busy={savingPurpose()}
                        class="channel-details-input channel-details-textarea"
                        disabled={savingPurpose()}
                        id="channel-details-purpose"
                        onBlur={savePurpose}
                        onInput={(e) => setPurposeInput(e.currentTarget.value)}
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
                    <ChannelSettingsTab channelId={d().id} />
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
