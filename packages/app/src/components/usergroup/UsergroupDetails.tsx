import { Button, InlineFeedback, type Pane, PanelHeader } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { closeTile } from "../../lib/paneActions";
import { actionFeedback, store } from "../../lib/store";
import type { UsergroupDetailsPaneContent } from "../../lib/store/slices/types";
import {
  loadUsergroupDetails,
  saveUsergroupProfile,
  usergroupDetailsLoadError,
  usergroupDetailsLoading,
  usergroupMutationPending,
} from "../../lib/usergroupDetails";
import MrkdwnComposer from "../composer/MrkdwnComposer";
import UsergroupChannelsTab from "./UsergroupChannelsTab";
import "./UsergroupDetails.css";
import UsergroupMembersTab from "./UsergroupMembersTab";

type Tab = "about" | "members" | "channels";

const TABS: { key: Tab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "members", label: "Members" },
  { key: "channels", label: "Channels" },
];

const blurOnEnter = (event: KeyboardEvent) => {
  if (event.key === "Enter") (event.currentTarget as HTMLElement).blur();
};

export default function UsergroupDetails(props: { pane: Pane<UsergroupDetailsPaneContent> }) {
  const usergroupId = () => props.pane.content.usergroupId;
  const [tab, setTab] = createSignal<Tab>("about");
  const [nameInput, setNameInput] = createSignal("");
  const [handleInput, setHandleInput] = createSignal("");
  const [descriptionInput, setDescriptionInput] = createSignal("");

  const details = createMemo(() => store.usergroups.usergroupDetailsById(usergroupId()));

  createEffect(on(usergroupId, () => setTab("about")));

  createEffect(
    on(details, (d) => {
      if (!d) return;
      setNameInput(d.title);
      setHandleInput(d.handle);
      setDescriptionInput(d.description);
    }),
  );

  const saveName = async () => {
    const v = nameInput().trim();
    if (!v || v === details()?.title) return;
    await saveUsergroupProfile(usergroupId(), { name: v });
  };

  const saveHandle = async () => {
    const v = handleInput().trim().replace(/^@/, "");
    if (!v || v === details()?.handle) return;
    await saveUsergroupProfile(usergroupId(), { handle: v });
  };

  const saveDescription = async () => {
    const v = descriptionInput().trim();
    if (v === (details()?.description ?? "")) return;
    await saveUsergroupProfile(usergroupId(), { description: v });
  };

  return (
    <div class="usergroup-details-panel" data-pane={props.pane.id}>
      <PanelHeader onClose={() => closeTile(props.pane.id)} title="Pinggroup" />
      <InlineFeedback
        class="usergroup-details-feedback"
        feedback={actionFeedback.get(usergroupId())}
        priority={2}
      />
      <div
        aria-busy={usergroupDetailsLoading() || usergroupMutationPending()}
        class="usergroup-details-body flex-col"
      >
        <Show when={details() && usergroupDetailsLoading()}>
          <div class="usergroup-details-load-notice text-dim text-sm">
            Refreshing pinggroup details…
          </div>
        </Show>
        <Show when={details() && usergroupDetailsLoadError()}>
          <div class="usergroup-details-load-notice usergroup-details-load-warning">
            <span>Couldn't refresh pinggroup details.</span>
            <Button onClick={() => loadUsergroupDetails(usergroupId())} size="sm">
              Try again
            </Button>
          </div>
        </Show>
        <Show when={usergroupMutationPending()}>
          <div class="usergroup-details-load-notice text-dim text-sm">
            Saving pinggroup changes…
          </div>
        </Show>
        <Show
          fallback={
            <Show
              fallback={
                <div class="usergroup-details-load-state flex-col">
                  <span>Couldn't load pinggroup details.</span>
                  <Button onClick={() => loadUsergroupDetails(usergroupId())} size="sm">
                    Try again
                  </Button>
                </div>
              }
              when={!usergroupDetailsLoadError()}
            >
              <p class="usergroup-details-meta usergroup-details-tab-content">
                Loading pinggroup details…
              </p>
            </Show>
          }
          when={details()}
        >
          {(d) => (
            <>
              <div class="usergroup-details-tabs">
                <For each={TABS}>
                  {(t) => (
                    <button
                      aria-pressed={tab() === t.key}
                      class="usergroup-details-tab btn-reset flex-align-center"
                      classList={{ active: tab() === t.key }}
                      onClick={() => setTab(t.key)}
                      type="button"
                    >
                      {t.label}
                      <Show when={t.key === "members" && d().memberCount}>
                        {(count) => <span class="usergroup-details-tab-count">{count()}</span>}
                      </Show>
                      <Show when={t.key === "channels" && d().channelIds.length}>
                        {(count) => <span class="usergroup-details-tab-count">{count()}</span>}
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              <Show when={tab() === "about"}>
                <div class="usergroup-details-tab-content flex-col">
                  <div class="usergroup-details-field flex-col">
                    <label class="usergroup-details-label" for="usergroup-details-name">
                      Name
                    </label>
                    <input
                      class="usergroup-details-input"
                      disabled={usergroupMutationPending()}
                      id="usergroup-details-name"
                      onBlur={saveName}
                      onInput={(e) => setNameInput(e.currentTarget.value)}
                      onKeyDown={blurOnEnter}
                      type="text"
                      value={nameInput()}
                    />
                  </div>
                  <div class="usergroup-details-field flex-col">
                    <label class="usergroup-details-label" for="usergroup-details-handle">
                      Handle
                    </label>
                    <div class="usergroup-details-handle-wrap flex-align-center">
                      <span class="usergroup-details-handle-prefix">@</span>
                      <input
                        class="usergroup-details-input"
                        disabled={usergroupMutationPending()}
                        id="usergroup-details-handle"
                        onBlur={saveHandle}
                        onInput={(e) => setHandleInput(e.currentTarget.value)}
                        onKeyDown={blurOnEnter}
                        type="text"
                        value={handleInput()}
                      />
                    </div>
                  </div>
                  <div class="usergroup-details-field flex-col">
                    <label class="usergroup-details-label" for="usergroup-details-description">
                      Description
                    </label>
                    <MrkdwnComposer
                      ariaLabel="Description"
                      disabled={usergroupMutationPending()}
                      id="usergroup-details-description"
                      multiline
                      onBlur={saveDescription}
                      onInput={setDescriptionInput}
                      placeholder="Add a description"
                      value={descriptionInput()}
                    />
                  </div>
                </div>
              </Show>

              <Show when={tab() === "members"}>
                <UsergroupMembersTab
                  disabled={usergroupMutationPending()}
                  memberIds={d().memberIds}
                  usergroupId={d().id}
                />
              </Show>

              <Show when={tab() === "channels"}>
                <UsergroupChannelsTab
                  channelIds={d().channelIds}
                  disabled={usergroupMutationPending()}
                  sectionEnabled={d().isSection}
                  usergroupId={d().id}
                />
              </Show>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
