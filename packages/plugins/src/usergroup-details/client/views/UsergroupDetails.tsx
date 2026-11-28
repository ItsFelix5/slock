import { service } from "@slock/core/solid";
import MrkdwnComposer from "@slock/plugins/composer/client/api/MrkdwnComposer";
import {
  ariaBoolean,
  Button,
  createResetSignal,
  InlineFeedback,
  type Pane,
  PanelHeader,
  useTabStripShortcuts,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import type { UsergroupDetailsPaneContent } from "../api";
import UsergroupChannelsTab from "./UsergroupChannelsTab";
import "./UsergroupDetails.css";
import UsergroupMembersTab from "./UsergroupMembersTab";
import {
  type EditableUsergroupDetails,
  editableUsergroupDetails,
  mergeUsergroupDetailsDraft,
  type UsergroupDetailsDraft,
} from "./usergroupDetailsDraft";

const groupActions = service("usergroup-details");

type Draft = { fields: UsergroupDetailsDraft; seeded: EditableUsergroupDetails | undefined };

const EMPTY_DRAFT: Draft = {
  fields: { description: "", handle: "", title: "" },
  seeded: undefined,
};

const feedback = service("feedback");

const viewStore = service("shell.view");

const usergroups = service("usergroups");

type Tab = "about" | "members" | "channels";

const TABS: { key: Tab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "members", label: "Members" },
  { key: "channels", label: "Channels" },
];

export default function UsergroupDetails(props: { pane: Pane<UsergroupDetailsPaneContent> }) {
  const usergroupId = () => props.pane.content.usergroupId;
  const [tab, setTab] = createResetSignal<Tab>(usergroupId, "about");
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;
  useTabStripShortcuts({
    activate: (next, nextIndex) => {
      setTab(next.key);
      tabButtonRefs[nextIndex]?.focus();
    },
    items: () => TABS,
    root: () => tabListRef,
  });
  const details = createMemo(() => usergroups.usergroupDetailsById(usergroupId()));
  const loading = () => groupActions.usergroupDetailsLoading(usergroupId());
  const loadError = () => groupActions.usergroupDetailsLoadError(usergroupId());
  const saving = () => groupActions.usergroupMutationPending(usergroupId());
  const [draft, setDraft] = createSignal((previous: Draft = EMPTY_DRAFT): Draft => {
    const d = details();
    if (!d) return previous;
    return {
      fields: mergeUsergroupDetailsDraft(previous.fields, previous.seeded, d),
      seeded: editableUsergroupDetails(d),
    };
  });
  const setField = (key: keyof UsergroupDetailsDraft) => (value: string) =>
    setDraft((previous) => ({ ...previous, fields: { ...previous.fields, [key]: value } }));
  const nameInput = () => draft().fields.title;
  const handleInput = () => draft().fields.handle;
  const descriptionInput = () => draft().fields.description;
  const setNameInput = setField("title");
  const setHandleInput = setField("handle");
  const setDescriptionInput = setField("description");

  createEffect(usergroupId, (id) => void groupActions.loadUsergroupDetails(id));

  const saveName = async () => {
    const v = nameInput().trim();
    if (!v || v === details()?.title) return;
    await groupActions.saveUsergroupProfile(usergroupId(), { name: v });
  };

  const saveHandle = async () => {
    const trimmed = handleInput().trim();
    const v = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    if (!v || v === details()?.handle) return;
    await groupActions.saveUsergroupProfile(usergroupId(), { handle: v });
  };

  const saveDescription = async () => {
    const v = descriptionInput().trim();
    if (v === (details()?.description ?? "")) return;
    await groupActions.saveUsergroupProfile(usergroupId(), { description: v });
  };

  return (
    <div class="usergroup-details-panel flex-col" data-pane={props.pane.id}>
      <PanelHeader
        canClose={viewStore.canCloseTile()}
        onClose={() => viewStore.closeTile(props.pane.id)}
        title="Pinggroup"
      />
      <InlineFeedback
        class="usergroup-details-feedback truncate"
        feedback={feedback.get(usergroupId())}
        priority={2}
      />
      <div aria-busy={ariaBoolean(loading() || saving())} class="usergroup-details-body flex-col">
        <Show when={details() && loading()}>
          <div class="usergroup-details-load-notice flex-center gap-sm text-dim text-sm">
            Refreshing pinggroup details…
          </div>
        </Show>
        <Show when={details() && loadError()}>
          <div class="usergroup-details-load-notice flex-center gap-sm usergroup-details-load-warning">
            <span>Couldn't refresh pinggroup details.</span>
            <Button onClick={() => groupActions.loadUsergroupDetails(usergroupId())} size="sm">
              Try again
            </Button>
          </div>
        </Show>
        <Show when={saving()}>
          <div class="usergroup-details-load-notice flex-center gap-sm text-dim text-sm">
            Saving pinggroup changes…
          </div>
        </Show>
        <Show
          fallback={
            <Show
              fallback={
                <div class="usergroup-details-load-state flex-col">
                  <span>Couldn't load pinggroup details.</span>
                  <Button
                    onClick={() => groupActions.loadUsergroupDetails(usergroupId())}
                    size="sm"
                  >
                    Try again
                  </Button>
                </div>
              }
              when={!loadError()}
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
              <div class="usergroup-details-tabs" ref={tabListRef} role="tablist">
                <For each={TABS}>
                  {(t, i) => (
                    <button
                      aria-selected={ariaBoolean(tab() === t.key)}
                      class={[
                        "usergroup-details-tab btn-reset flex-align-center",
                        { active: tab() === t.key },
                      ]}
                      onClick={() => setTab(t.key)}
                      ref={(el) => {
                        tabButtonRefs[untrack(i)] = el;
                      }}
                      role="tab"
                      tabindex={tab() === t.key ? 0 : -1}
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
                    <label class="field-label" for="usergroup-details-name">
                      Name
                    </label>
                    <input
                      class="text-field"
                      disabled={saving()}
                      id="usergroup-details-name"
                      onBlur={saveName}
                      onInput={(e) => setNameInput(e.currentTarget.value)}
                      data-commit-on-enter
                      type="text"
                      value={nameInput()}
                    />
                  </div>
                  <div class="usergroup-details-field flex-col">
                    <label class="field-label" for="usergroup-details-handle">
                      Handle
                    </label>
                    <div class="usergroup-details-handle-wrap flex-align-center">
                      <span class="usergroup-details-handle-prefix">@</span>
                      <input
                        class="text-field"
                        disabled={saving()}
                        id="usergroup-details-handle"
                        onBlur={saveHandle}
                        onInput={(e) => setHandleInput(e.currentTarget.value)}
                        data-commit-on-enter
                        type="text"
                        value={handleInput()}
                      />
                    </div>
                  </div>
                  <div class="usergroup-details-field flex-col">
                    <label class="field-label" for="usergroup-details-description">
                      Description
                    </label>
                    <MrkdwnComposer
                      ariaLabel="Description"
                      disabled={saving()}
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
                  disabled={saving()}
                  memberIds={d().memberIds}
                  usergroupId={d().id}
                />
              </Show>

              <Show when={tab() === "channels"}>
                <UsergroupChannelsTab
                  channelIds={d().channelIds}
                  disabled={saving()}
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
