import { AddRowButton, Avatar, IconButton, Switch } from "@slock/ui";
import { createEffect, createResource, createSignal, For, on, Show } from "solid-js";
import { store } from "../../../lib/store";
import ComposeUserPicker from "../../composer/popovers/ComposeUserPicker";
import { loadChannelPostingPrefs, updateChannelPostingPrefs } from "../lib/channelDetails";
import SettingsLoadError, { errorMessage } from "./SettingsLoadError";

export default function ChannelPostingPermissions(props: { channelId: string }) {
  const [postingPrefs, { refetch: refetchPostingPrefs }] = createResource(
    () => props.channelId,
    loadChannelPostingPrefs,
  );
  const [postingRestricted, setPostingRestricted] = createSignal(false);
  const [postingExceptionUserIds, setPostingExceptionUserIds] = createSignal<string[]>([]);
  const [threadsRestricted, setThreadsRestricted] = createSignal(false);
  const [allowChannelMentions, setAllowChannelMentions] = createSignal(true);
  const [savingPostingPrefs, setSavingPostingPrefs] = createSignal(false);
  const [addingPostingException, setAddingPostingException] = createSignal(false);
  const [postingPrefsSaveError, setPostingPrefsSaveError] = createSignal<string>();

  const retryPostingPrefs = () => void Promise.resolve(refetchPostingPrefs()).catch(() => {});

  createEffect(
    on(postingPrefs, (prefs) => {
      if (!prefs) return;
      setPostingRestricted(prefs.postingRestrictedToManagers);
      setPostingExceptionUserIds(prefs.postingExceptionUserIds);
      setThreadsRestricted(prefs.threadsRestrictedToManagers);
      setAllowChannelMentions(prefs.allowChannelMentions);
    }),
  );

  const canEdit = () => !!postingPrefs() && !savingPostingPrefs();

  const savePostingPrefs = async (
    patch: Parameters<typeof updateChannelPostingPrefs>[1],
    restore: () => void,
  ) => {
    setSavingPostingPrefs(true);
    setPostingPrefsSaveError(undefined);
    try {
      await updateChannelPostingPrefs(props.channelId, patch);
    } catch (error) {
      restore();
      setPostingPrefsSaveError(errorMessage(error, "Failed to update posting permissions."));
    } finally {
      setSavingPostingPrefs(false);
    }
  };

  const savePostingRestriction = async (restricted: boolean) => {
    if (!canEdit()) return;
    const previousRestricted = postingRestricted();
    const previousExceptions = postingExceptionUserIds();
    const nextExceptions = restricted ? previousExceptions : [];
    setPostingRestricted(restricted);
    setPostingExceptionUserIds(nextExceptions);
    if (!restricted) setAddingPostingException(false);
    await savePostingPrefs(
      { posting: { exceptionUserIds: nextExceptions, restrictedToManagers: restricted } },
      () => {
        setPostingRestricted(previousRestricted);
        setPostingExceptionUserIds(previousExceptions);
      },
    );
  };

  const savePostingExceptions = async (next: string[]) => {
    if (!canEdit()) return;
    const previous = postingExceptionUserIds();
    setPostingExceptionUserIds(next);
    setAddingPostingException(false);
    await savePostingPrefs(
      { posting: { exceptionUserIds: next, restrictedToManagers: true } },
      () => setPostingExceptionUserIds(previous),
    );
  };

  const addPostingException = (userId: string) => {
    const current = postingExceptionUserIds();
    if (current.length >= 100 || current.includes(userId)) return;
    savePostingExceptions([...current, userId]);
  };

  const removePostingException = (userId: string) => {
    savePostingExceptions(postingExceptionUserIds().filter((id) => id !== userId));
  };

  const saveThreadsRestriction = async (restricted: boolean) => {
    if (!canEdit()) return;
    const previous = threadsRestricted();
    setThreadsRestricted(restricted);
    await savePostingPrefs({ threadsRestrictedToManagers: restricted }, () =>
      setThreadsRestricted(previous),
    );
  };

  const saveChannelMentions = async (enabled: boolean) => {
    if (!canEdit()) return;
    const previous = allowChannelMentions();
    setAllowChannelMentions(enabled);
    await savePostingPrefs({ allowChannelMentions: enabled }, () =>
      setAllowChannelMentions(previous),
    );
  };

  return (
    <div class="settings-section">
      <div class="settings-row-label">Posting permissions</div>
      <Show when={postingPrefs.loading}>
        <p class="channel-details-meta">Loading posting permissions…</p>
      </Show>
      <Show when={postingPrefs.error}>
        <SettingsLoadError
          error={postingPrefs.error}
          message="Posting permissions couldn't be loaded."
          onRetry={retryPostingPrefs}
        />
      </Show>
      <Show when={postingPrefsSaveError()}>
        <div class="channel-details-settings-warning">
          <div>Posting permissions couldn't be saved.</div>
          <div class="channel-details-settings-error-code">{postingPrefsSaveError()}</div>
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
                      when={store.users.userById(userId)}
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
