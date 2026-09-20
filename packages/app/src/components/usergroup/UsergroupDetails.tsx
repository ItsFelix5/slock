import {
  Button,
  blurOnEnter,
  InlineFeedback,
  type Pane,
  PanelHeader,
  tabStripKeyDown,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
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
import {
  type EditableUsergroupDetails,
  editableUsergroupDetails,
  mergeUsergroupDetailsDraft,
} from "./usergroupDetailsDraft";

const LEADING_AT_RE = /^@/;

type Tab = "about" | "members" | "channels";

const TABS: { key: Tab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "members", label: "Members" },
  { key: "channels", label: "Channels" },
];

export default function UsergroupDetails(props: { pane: Pane<UsergroupDetailsPaneContent> }) {
  const usergroupId = () => props.pane.content.usergroupId;
  const [tab, setTab] = createSignal<Tab>("about");
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  const [nameInput, setNameInput] = createSignal("");
  const [handleInput, setHandleInput] = createSignal("");
  const [descriptionInput, setDescriptionInput] = createSignal("");

  const details = createMemo(() => store.usergroups.usergroupDetailsById(usergroupId()));

  createEffect(on(usergroupId, () => setTab("about")));

  createEffect(on(usergroupId, (id) => void loadUsergroupDetails(id)));

  let seededDetails: EditableUsergroupDetails | undefined;
  createEffect(
    on(details, (d) => {
      if (!d) return;
      const merged = mergeUsergroupDetailsDraft(
        { description: descriptionInput(), handle: handleInput(), title: nameInput() },
        seededDetails,
        d,
      );
      setNameInput(merged.title);
      setHandleInput(merged.handle);
      setDescriptionInput(merged.description);
      seededDetails = editableUsergroupDetails(d);
    }),
  );

  const saveName = async () => {
    const v = nameInput().trim();
    if (!v || v === details()?.title) return;
    await saveUsergroupProfile(usergroupId(), { name: v });
  };

  const saveHandle = async () => {
    const v = handleInput().trim().replace(LEADING_AT_RE, "");
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
      <PanelHeader
        canClose={store.viewState.canCloseTile()}
        onClose={() => store.viewState.closeTile(props.pane.id)}
        title="Pinggroup"
      />
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
              <div class="usergroup-details-tabs" role="tablist">
                <For each={TABS}>
                  {(t, i) => (
                    <button
                      aria-selected={tab() === t.key}
                      class="usergroup-details-tab btn-reset flex-align-center"
                      classList={{ active: tab() === t.key }}
                      onClick={() => setTab(t.key)}
                      onKeyDown={(e) =>
                        tabStripKeyDown(e, TABS, i(), (next, nextIndex) => {
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
