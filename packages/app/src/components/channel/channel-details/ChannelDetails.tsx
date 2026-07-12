import {
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
import { actionFeedback, userById } from "../../../lib/store";
import ChannelMembersTab from "./ChannelMembersTab";
import "./ChannelDetails.css";
import ChannelSettingsTab from "./ChannelSettingsTab";

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

  useEscapeClose(closeChannelDetails);

  const [details, { refetch }] = createResource(channelDetailsId, loadChannelDetails);

  createEffect(on(channelDetailsId, () => setTab("about")));

  // Form fields seed once per fetched details, not on every input keystroke.
  createEffect(
    on(details, (d) => {
      if (!d) return;
      setTopicInput(d.topic);
      setPurposeInput(d.purpose);
      setNameInput(d.name);
    }),
  );

  const saveTopic = async () => {
    const id = channelDetailsId();
    const v = topicInput().trim();
    if (!id || v === details()?.topic) return;
    if (await updateChannelTopic(id, v)) refetch();
  };

  const savePurpose = async () => {
    const id = channelDetailsId();
    const v = purposeInput().trim();
    if (!id || v === details()?.purpose) return;
    if (await updateChannelPurpose(id, v)) refetch();
  };

  const saveName = async () => {
    const id = channelDetailsId();
    const v = nameInput().trim().replace(/^#/, "");
    if (!id || !v || v === details()?.name) return;
    if (await renameChannelById(id, v)) refetch();
  };

  const [copiedKey, copy] = createCopyFeedback();

  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") (e.currentTarget as HTMLElement).blur();
  };

  const createdLine = createMemo(() => {
    const d = details();
    if (!d?.created) return null;
    const date = new Date(d.created * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const creator = d.creatorId ? userById(d.creatorId)?.name : undefined;
    return creator ? `Created by ${creator} on ${date}` : `Created on ${date}`;
  });

  return (
    <Show when={channelDetailsId()}>
      {(id) => (
        <Overlay onClose={closeChannelDetails}>
          <Show
            when={details()}
            fallback={
              <div class="channel-details-card">
                <PanelHeader onClose={closeChannelDetails}>
                  <span class="channel-details-header-name">Channel details</span>
                </PanelHeader>
                <Show when={!details.loading}>
                  <div class="channel-details-load-error">
                    <InlineFeedback feedback={actionFeedback.get(id())} />
                  </div>
                </Show>
              </div>
            }
          >
            {(d) => (
              <div class="channel-details-card">
                <PanelHeader onClose={closeChannelDetails}>
                  <span class="channel-details-header-icon">
                    {d().private ? <Icon name="lock" size={16} /> : "#"}
                  </span>
                  <span class="channel-details-header-name">{d().name}</span>
                </PanelHeader>

                <div class="channel-details-tabs">
                  <For each={TABS}>
                    {(t) => (
                      <button
                        type="button"
                        class="channel-details-tab"
                        classList={{ active: tab() === t.key }}
                        onClick={() => setTab(t.key)}
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
                  feedback={actionFeedback.get(d().id)}
                  class="channel-details-feedback"
                />

                <div class="channel-details-body">
                  <Show when={tab() === "about"}>
                    <div class="channel-details-field">
                      <label class="channel-details-label" for="channel-details-name">
                        Channel name
                      </label>
                      <div class="channel-details-name-wrap">
                        <span class="channel-details-name-prefix">
                          {d().private ? <Icon name="lock" size={13} /> : "#"}
                        </span>
                        <input
                          id="channel-details-name"
                          class="channel-details-input"
                          type="text"
                          value={nameInput()}
                          onInput={(e) => setNameInput(e.currentTarget.value)}
                          onBlur={saveName}
                          onKeyDown={blurOnEnter}
                        />
                      </div>
                    </div>
                    <div class="channel-details-field">
                      <label class="channel-details-label" for="channel-details-topic">
                        Topic
                      </label>
                      <input
                        id="channel-details-topic"
                        class="channel-details-input"
                        type="text"
                        placeholder="Add a topic"
                        value={topicInput()}
                        onInput={(e) => setTopicInput(e.currentTarget.value)}
                        onBlur={saveTopic}
                        onKeyDown={blurOnEnter}
                      />
                    </div>
                    <div class="channel-details-field">
                      <label class="channel-details-label" for="channel-details-purpose">
                        Description
                      </label>
                      <textarea
                        id="channel-details-purpose"
                        class="channel-details-input channel-details-textarea"
                        placeholder="Add a description"
                        value={purposeInput()}
                        onInput={(e) => setPurposeInput(e.currentTarget.value)}
                        onBlur={savePurpose}
                      />
                    </div>
                    <Show when={createdLine()}>
                      <p class="channel-details-meta">{createdLine()}</p>
                    </Show>
                    <div class="channel-details-copy-list">
                      <Show when={d().email}>
                        {(email) => (
                          <button
                            type="button"
                            class="channel-details-copy-row"
                            onClick={() => copy(email(), "email")}
                          >
                            <Icon name="email-filled" size={15} />
                            <span class="channel-details-copy-value">{email()}</span>
                            <Icon name={copiedKey() === "email" ? "check" : "copy"} size={14} />
                          </button>
                        )}
                      </Show>
                      <button
                        type="button"
                        class="channel-details-copy-row"
                        onClick={() => copy(`${location.origin}/#${d().id}`, "link")}
                      >
                        <Icon name="link" size={15} />
                        <span class="channel-details-copy-value">Copy link to channel</span>
                        <Icon name={copiedKey() === "link" ? "check" : "copy"} size={14} />
                      </button>
                      <button
                        type="button"
                        class="channel-details-copy-row"
                        onClick={() => copy(d().id, "id")}
                      >
                        <Icon name="info" size={15} />
                        <span class="channel-details-copy-value">Channel ID: {d().id}</span>
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
                    <ChannelSettingsTab channelId={d().id} private={d().private} />
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
