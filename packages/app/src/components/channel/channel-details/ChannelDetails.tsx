import { Icon, type IconName, Overlay, showToast, useEscapeClose } from "@slock/ui";
import { createEffect, createMemo, createResource, createSignal, For, on, Show } from "solid-js";
import {
  channelDetailsId,
  closeChannelDetails,
  loadChannelDetails,
  renameChannelById,
  updateChannelPurpose,
  updateChannelTopic,
} from "../../../lib/channelDetails";
import { userById } from "../../../lib/store";
import ChannelMembersTab from "./ChannelMembersTab";
import "./ChannelDetails.css";
import ChannelSettingsTab from "./ChannelSettingsTab";

type Tab = "about" | "members" | "tabs" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "members", label: "Members" },
  { key: "tabs", label: "Tabs" },
  { key: "settings", label: "Settings" },
];

const TAB_ICONS: Record<string, IconName> = {
  messages: "message-filled",
  canvas: "canvas-filled",
  files: "files-filled",
  bookmarks: "bookmark-filled",
  lists: "lists-filled",
  workflows: "bolt-filled",
};

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

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied.`);
  };

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
    <Show when={channelDetailsId() ? details() : undefined}>
      {(d) => (
        <Overlay onClose={closeChannelDetails}>
          <div class="channel-details-card">
            <div class="channel-details-header">
              <span class="channel-details-header-icon">
                {d().private ? <Icon name="lock" size={16} /> : "#"}
              </span>
              <span class="channel-details-header-name">{d().name}</span>
              <button
                type="button"
                class="channel-details-close"
                onClick={closeChannelDetails}
                title="Close"
              >
                ✕
              </button>
            </div>

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
                        onClick={() => copyText(email(), "Email address")}
                      >
                        <Icon name="email-filled" size={15} />
                        <span class="channel-details-copy-value">{email()}</span>
                        <Icon name="copy" size={14} />
                      </button>
                    )}
                  </Show>
                  <button
                    type="button"
                    class="channel-details-copy-row"
                    onClick={() => copyText(`${location.origin}/#${d().id}`, "Channel link")}
                  >
                    <Icon name="link" size={15} />
                    <span class="channel-details-copy-value">Copy link to channel</span>
                    <Icon name="copy" size={14} />
                  </button>
                  <button
                    type="button"
                    class="channel-details-copy-row"
                    onClick={() => copyText(d().id, "Channel ID")}
                  >
                    <Icon name="info" size={15} />
                    <span class="channel-details-copy-value">Channel ID: {d().id}</span>
                    <Icon name="copy" size={14} />
                  </button>
                </div>
              </Show>

              <Show when={tab() === "members"}>
                <ChannelMembersTab channelId={d().id} channelName={d().name} />
              </Show>

              <Show when={tab() === "tabs"}>
                {/* Read-only: tab layout comes from conversations.info's
                    properties.tabs, but no non-admin write endpoint for it is
                    known — nothing to guess a mutation against. */}
                <div class="channel-details-tab-list">
                  <For
                    each={d().tabs}
                    fallback={<p class="channel-details-empty">This channel has no extra tabs.</p>}
                  >
                    {(t) => (
                      <div class="channel-details-tab-row">
                        <Icon name={TAB_ICONS[t.type] ?? "open-in-tab"} size={15} />
                        <span>{t.label ?? t.type.charAt(0).toUpperCase() + t.type.slice(1)}</span>
                      </div>
                    )}
                  </For>
                </div>
                <p class="channel-details-meta">Tab layout can only be changed in Slack.</p>
              </Show>

              <Show when={tab() === "settings"}>
                <ChannelSettingsTab channelId={d().id} private={d().private} />
              </Show>
            </div>
          </div>
        </Overlay>
      )}
    </Show>
  );
}
