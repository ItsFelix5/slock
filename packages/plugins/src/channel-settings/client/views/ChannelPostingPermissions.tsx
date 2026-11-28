import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import ComposeUserPicker from "@slock/plugins/composer/client/api/pickers/ComposeUserPicker";
import { isWaiting } from "@slock/resource";
import type { ChannelId, ChannelPostingPrefsPatch, UserId } from "@slock/types";
import { AddRowButton, Avatar, IconButton, Switch } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { postingPrefs, savingPosting } from "../store";
import SettingsLoadError from "./SettingsLoadError";
import "./ChannelPostingPermissions.css";

const usersStore = service("users");

export default function ChannelPostingPermissions(props: { channelId: ChannelId }) {
  const prefs = postingPrefs.state(() => props.channelId);
  const postingRestricted = () => prefs().data?.postingRestrictedToManagers ?? false;
  const postingExceptionUserIds = () => prefs().data?.postingExceptionUserIds ?? [];
  const threadsRestricted = () => prefs().data?.threadsRestrictedToManagers ?? false;
  const allowChannelMentions = () => prefs().data?.allowChannelMentions ?? true;
  const [addingPostingException, setAddingPostingException] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string>();

  const retryPostingPrefs = () => void postingPrefs.refresh(props.channelId).catch(() => {});

  const canEdit = () => !!prefs().data && !savingPosting.pending(props.channelId);

  const save = (patch: ChannelPostingPrefsPatch) => {
    setSaveError(undefined);
    return savingPosting.run({
      channelId: props.channelId,
      onFailure: (error) =>
        setSaveError(errorMessage(error, "Failed to update posting permissions.")),
      patch,
    });
  };

  const savePostingRestriction = (restricted: boolean) => {
    if (!canEdit()) return;
    const exceptionUserIds = restricted ? postingExceptionUserIds() : [];
    if (!restricted) setAddingPostingException(false);
    void save({ posting: { exceptionUserIds, restrictedToManagers: restricted } });
  };

  const savePostingExceptions = (exceptionUserIds: UserId[]) => {
    if (!canEdit()) return;
    setAddingPostingException(false);
    void save({ posting: { exceptionUserIds, restrictedToManagers: true } });
  };

  const addPostingException = (userId: UserId) => {
    const current = postingExceptionUserIds();
    if (current.length >= 100 || current.includes(userId)) return;
    savePostingExceptions([...current, userId]);
  };

  const removePostingException = (userId: UserId) => {
    savePostingExceptions(postingExceptionUserIds().filter((id) => id !== userId));
  };

  const saveThreadsRestriction = (restricted: boolean) => {
    if (canEdit()) void save({ threadsRestrictedToManagers: restricted });
  };

  const saveChannelMentions = (enabled: boolean) => {
    if (canEdit()) void save({ allowChannelMentions: enabled });
  };

  return (
    <div class="settings-section">
      <div class="settings-section-title">Posting permissions</div>
      <Show when={isWaiting(prefs())}>
        <p class="channel-details-meta">Loading posting permissions…</p>
      </Show>
      <Show when={prefs().error}>
        <SettingsLoadError
          error={prefs().error}
          message="Posting permissions couldn't be loaded."
          onRetry={retryPostingPrefs}
        />
      </Show>
      <Show when={saveError()}>
        <div class="channel-details-settings-warning">
          <div>Posting permissions couldn't be saved.</div>
          <div class="channel-details-settings-error-code">{saveError()}</div>
        </div>
      </Show>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Only channel managers can post</div>
        </div>
        <Switch
          checked={postingRestricted()}
          disabled={!canEdit()}
          onChange={savePostingRestriction}
        />
      </div>
      <Show when={postingRestricted()}>
        <div class="channel-details-exceptions">
          <div class="channel-details-exceptions-header flex-align-center">
            <div class="settings-row-label">Exceptions</div>
            <AddRowButton
              disabled={!canEdit() || postingExceptionUserIds().length >= 100}
              icon="user-add"
              label="Add people"
              onClick={() => setAddingPostingException(true)}
            />
          </div>
          <Show
            fallback={<p class="channel-details-meta">No exceptions.</p>}
            when={postingExceptionUserIds().length > 0}
          >
            <div class="channel-details-exception-list flex-col">
              <For each={postingExceptionUserIds()}>
                {(userId) => (
                  <div class="channel-details-exception flex-align-center">
                    <Show
                      fallback={
                        <span class="channel-details-exception-name truncate">{userId}</span>
                      }
                      when={usersStore.userById(userId)}
                    >
                      {(user) => (
                        <>
                          <Avatar size="small" user={user()} />
                          <span class="channel-details-exception-name truncate">{user().name}</span>
                        </>
                      )}
                    </Show>
                    <IconButton
                      class="channel-details-exception-remove"
                      disabled={!canEdit()}
                      icon="close-filled"
                      iconSize={14}
                      label="Remove exception"
                      onClick={() => removePostingException(userId)}
                    />
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show when={addingPostingException()}>
            <div class="channel-details-picker">
              <ComposeUserPicker
                excludeUserIds={postingExceptionUserIds()}
                includeCurrentUser
                onClose={() => setAddingPostingException(false)}
                onSelect={addPostingException}
              />
            </div>
          </Show>
        </div>
      </Show>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Only channel managers can reply in threads</div>
        </div>
        <Switch
          checked={threadsRestricted()}
          disabled={!canEdit()}
          onChange={saveThreadsRestriction}
        />
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">Allow @channel and @here mentions</div>
        </div>
        <Switch
          checked={allowChannelMentions()}
          disabled={!canEdit()}
          onChange={saveChannelMentions}
        />
      </div>
    </div>
  );
}
