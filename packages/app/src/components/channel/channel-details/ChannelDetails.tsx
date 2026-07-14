// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to the save operation.
import { createCopyFeedback, Icon, InlineFeedback, Overlay, useEscapeClose } from "@slock/ui";
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
    if (!(id && v) || v === details()?.name) return;
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
        <Overlay onClose={closeChannelDetails}>
          <Show
            fallback={
              <div class="channel-details-card flex-col">
                <Show when={!details.loading}>
                  <div class="channel-details-load-error">
                    <InlineFeedback feedback={actionFeedback.get(id())} />
                  </div>
                </Show>
              </div>
            }
            when={details()}
          >
            {(d) => (
              <div class="channel-details-card flex-col">
                <div class="channel-details-tabs">
                  <For each={TABS}>
                    {(t) => (
                      <button
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
                          class="channel-details-input"
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
                        class="channel-details-input"
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
                        class="channel-details-input channel-details-textarea"
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
