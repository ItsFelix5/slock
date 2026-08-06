import { Avatar, Button, Icon, Switch, Tooltip } from "@slock/ui";
import { createEffect, createResource, createSignal, For, on, Show } from "solid-js";
import { loadChannelPostingPrefs, updateChannelPostingPrefs } from "../../../lib/channelDetails";
import { store } from "../../../lib/store";
import ComposeUserPicker from "../../composer/popovers/ComposeUserPicker";

export default function ChannelPostingPermissions(props: {
  channelId: string;
  isManager: () => boolean;
}) {
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

  const canEdit = () => !!postingPrefs() && props.isManager() && !savingPostingPrefs();

  const savePostingRestriction = async (restricted: boolean) => {
    if (!canEdit()) return;
    const previousRestricted = postingRestricted();
    const previousExceptions = postingExceptionUserIds();
    const nextExceptions = restricted ? previousExceptions : [];
    setPostingRestricted(restricted);
    setPostingExceptionUserIds(nextExceptions);
    if (!restricted) setAddingPostingException(false);
    setSavingPostingPrefs(true);
    const ok = await updateChannelPostingPrefs(props.channelId, {
      posting: { exceptionUserIds: nextExceptions, restrictedToManagers: restricted },
    });
    if (!ok) {
      setPostingRestricted(previousRestricted);
      setPostingExceptionUserIds(previousExceptions);
    }
    setSavingPostingPrefs(false);
  };

  const savePostingExceptions = async (next: string[]) => {
    if (!canEdit()) return;
    const previous = postingExceptionUserIds();
    setPostingExceptionUserIds(next);
    setAddingPostingException(false);
    setSavingPostingPrefs(true);
    const ok = await updateChannelPostingPrefs(props.channelId, {
      posting: { exceptionUserIds: next, restrictedToManagers: true },
    });
    if (!ok) setPostingExceptionUserIds(previous);
    setSavingPostingPrefs(false);
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
    setSavingPostingPrefs(true);
    const ok = await updateChannelPostingPrefs(props.channelId, {
      threadsRestrictedToManagers: restricted,
    });
    if (!ok) setThreadsRestricted(previous);
    setSavingPostingPrefs(false);
  };

  const saveChannelMentions = async (enabled: boolean) => {
    if (!canEdit()) return;
    const previous = allowChannelMentions();
    setAllowChannelMentions(enabled);
    setSavingPostingPrefs(true);
    const ok = await updateChannelPostingPrefs(props.channelId, {
      allowChannelMentions: enabled,
    });
    if (!ok) setAllowChannelMentions(previous);
    setSavingPostingPrefs(false);
  };

  return (
    <div class="settings-section">
      <div class="settings-row-label">Posting permissions</div>
      <Show when={postingPrefs.loading}>
        <p class="channel-details-meta">Loading posting permissions…</p>
      </Show>
      <Show when={postingPrefs.error}>
        <div class="channel-details-settings-warning flex-between" role="alert">
          <span>Posting permissions couldn’t be loaded.</span>
          <Button onClick={retryPostingPrefs} size="sm">
            Try again
          </Button>
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
          title="Only channel managers can post"
        />
      </div>
      <Show when={postingRestricted()}>
        <div class="channel-details-exceptions">
          <div class="channel-details-exceptions-header flex-align-center">
            <div>
              <div class="settings-row-label">Exceptions</div>
              <div class="settings-row-hint text-dim">
                These people can post even when posting is restricted.
              </div>
            </div>
            <button
              class="channel-details-add-btn btn-reset flex-align-center"
              disabled={!canEdit() || postingExceptionUserIds().length >= 100}
              onClick={() => setAddingPostingException(true)}
              type="button"
            >
              <Icon name="user-add" size={15} /> Add people
            </button>
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
                    <Tooltip content="Remove exception">
                      <button
                        aria-label="Remove exception"
                        class="channel-details-exception-remove btn-reset flex-center"
                        disabled={!canEdit()}
                        onClick={() => removePostingException(userId)}
                        type="button"
                      >
                        <Icon name="close-filled" size={14} />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show when={postingExceptionUserIds().length >= 100}>
            <p class="channel-details-meta">Slack allows up to 100 exceptions per channel.</p>
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
          title="Only channel managers can reply in threads"
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
          title="Allow @channel and @here mentions"
        />
      </div>
    </div>
  );
}
