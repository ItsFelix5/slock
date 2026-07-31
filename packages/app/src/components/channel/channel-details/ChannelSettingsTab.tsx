import { Avatar, Button, Icon, Switch, Tooltip } from "@slock/ui";
import { createEffect, createMemo, createResource, createSignal, For, on, Show } from "solid-js";
import {
  loadChannelManagerIds,
  loadChannelPostingPrefs,
  updateChannelPostingPrefs,
  updateChannelRetention,
  updateMemberPermissions,
} from "../../../lib/channelDetails";
import { store } from "../../../lib/store";
import ComposeUserPicker from "../../composer/popovers/ComposeUserPicker";
import "../../settings/Settings.css";
import "./ChannelDetails.css";
import "./ChannelSettingsTab.css";
import {
  type AppliedPermissionChoice,
  type AppliedRetentionChoice,
  memberPermissionPatch,
  retentionValue,
} from "./settings/channelPolicy";

export default function ChannelSettingsTab(props: { channelId: string }) {
  // These are all channel-manager-only actions on the real Slack client (the
  // API calls themselves would just reject a non-manager), so the controls
  // below are read-only until this resolves the current user as a manager.
  const [managerIds, { refetch: refetchManagerIds }] = createResource(
    () => props.channelId,
    loadChannelManagerIds,
  );
  const isManager = createMemo(() => {
    if (managerIds.error) return false;
    const me = store.users.currentUser()?.id;
    return !!me && (managerIds() ?? []).includes(me);
  });

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

  const retryManagerIds = () => void Promise.resolve(refetchManagerIds()).catch(() => {});
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

  const canEditPostingPrefs = createMemo(
    () => !!postingPrefs() && isManager() && !savingPostingPrefs(),
  );
  // conversations.permissions.accountTypes.set's FULL_MEMBER `is_allowed` flags
  // are the same "channel managers only" restriction as who_can_post/can_thread
  // above — inverted here so every switch in this tab reads the same way
  // ("Only channel managers can ___", on = restricted).
  type PermissionChoice = "" | AppliedPermissionChoice;
  const [invitePermission, setInvitePermission] = createSignal<PermissionChoice>("");
  const [topicPermission, setTopicPermission] = createSignal<PermissionChoice>("");
  const [purposePermission, setPurposePermission] = createSignal<PermissionChoice>("");
  const [savingMemberPermissions, setSavingMemberPermissions] = createSignal(false);

  // Retention changes post a visible system message to the channel, so
  // unlike the other toggles this doesn't auto-commit on change — it needs
  // an explicit Save so flipping the switch or editing the day count doesn't
  // spam the channel with a message per change.
  type RetentionChoice = "" | AppliedRetentionChoice;
  const [retentionChoice, setRetentionChoice] = createSignal<RetentionChoice>("");
  const [retentionDays, setRetentionDays] = createSignal(90);
  const [savedRetention, setSavedRetention] = createSignal<{
    choice: AppliedRetentionChoice;
    days: number;
  } | null>(null);
  const [savingRetention, setSavingRetention] = createSignal(false);

  const retentionDirty = createMemo(() => {
    const choice = retentionChoice();
    if (!choice) return false;
    const saved = savedRetention();
    return (
      !saved || choice !== saved.choice || (choice === "delete" && retentionDays() !== saved.days)
    );
  });

  const savePostingRestriction = async (restricted: boolean) => {
    if (!canEditPostingPrefs()) return;
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
    if (!canEditPostingPrefs()) return;
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
    if (!canEditPostingPrefs()) return;
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
    if (!canEditPostingPrefs()) return;
    const previous = allowChannelMentions();
    setAllowChannelMentions(enabled);
    setSavingPostingPrefs(true);
    const ok = await updateChannelPostingPrefs(props.channelId, {
      allowChannelMentions: enabled,
    });
    if (!ok) setAllowChannelMentions(previous);
    setSavingPostingPrefs(false);
  };

  const saveRetention = async () => {
    const choice = retentionChoice();
    if (!choice) return;
    const days = retentionDays();
    setSavingRetention(true);
    const ok = await updateChannelRetention(props.channelId, retentionValue(choice, days));
    if (ok) setSavedRetention({ choice, days });
    setSavingRetention(false);
  };

  const saveMemberPermission = async (
    permission: "invite" | "topic" | "purpose",
    choice: PermissionChoice,
  ) => {
    if (!(choice && isManager() && !savingMemberPermissions())) return;
    const current = {
      invite: invitePermission(),
      purpose: purposePermission(),
      topic: topicPermission(),
    };
    const setChoice =
      permission === "invite"
        ? setInvitePermission
        : permission === "topic"
          ? setTopicPermission
          : setPurposePermission;
    setChoice(choice);
    setSavingMemberPermissions(true);
    const ok = await updateMemberPermissions(
      props.channelId,
      memberPermissionPatch(permission, choice),
    );
    if (!ok) setChoice(current[permission]);
    setSavingMemberPermissions(false);
  };

  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") (e.currentTarget as HTMLElement).blur();
  };

  return (
    <>
      <Show when={managerIds.error}>
        <div class="channel-details-settings-warning flex-between" role="alert">
          <span>Couldn’t verify whether you manage this channel.</span>
          <Button onClick={retryManagerIds} size="sm">
            Try again
          </Button>
        </div>
      </Show>
      <Show when={managerIds.state === "ready" && !isManager()}>
        <p class="channel-details-meta">Only channel managers can change these settings.</p>
      </Show>

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
            disabled={!canEditPostingPrefs()}
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
                disabled={!canEditPostingPrefs() || postingExceptionUserIds().length >= 100}
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
                            <span class="channel-details-exception-name truncate">
                              {user().name}
                            </span>
                          </>
                        )}
                      </Show>
                      <Tooltip content="Remove exception">
                        <button
                          aria-label="Remove exception"
                          class="channel-details-exception-remove btn-reset flex-center"
                          disabled={!canEditPostingPrefs()}
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
            disabled={!canEditPostingPrefs()}
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
            disabled={!canEditPostingPrefs()}
            onChange={saveChannelMentions}
            title="Allow @channel and @here mentions"
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Member permissions</div>
        <p class="channel-details-meta">
          Slack doesn’t expose the current values here. Choose an explicit policy to change only
          that permission.
        </p>
        <div class="settings-row flex-between">
          <label class="settings-row-label" for="channel-member-invite-permission">
            Who can invite others
          </label>
          <select
            class="channel-details-input channel-details-setting-select"
            disabled={!isManager() || savingMemberPermissions()}
            id="channel-member-invite-permission"
            onChange={(event) =>
              saveMemberPermission("invite", event.currentTarget.value as PermissionChoice)
            }
            value={invitePermission()}
          >
            <option disabled value="">
              Choose a policy…
            </option>
            <option value="allow">All members</option>
            <option value="restrict">Channel managers only</option>
          </select>
        </div>
        <div class="settings-row flex-between">
          <label class="settings-row-label" for="channel-member-topic-permission">
            Who can change the topic
          </label>
          <select
            class="channel-details-input channel-details-setting-select"
            disabled={!isManager() || savingMemberPermissions()}
            id="channel-member-topic-permission"
            onChange={(event) =>
              saveMemberPermission("topic", event.currentTarget.value as PermissionChoice)
            }
            value={topicPermission()}
          >
            <option disabled value="">
              Choose a policy…
            </option>
            <option value="allow">All members</option>
            <option value="restrict">Channel managers only</option>
          </select>
        </div>
        <div class="settings-row flex-between">
          <label class="settings-row-label" for="channel-member-purpose-permission">
            Who can change the description
          </label>
          <select
            class="channel-details-input channel-details-setting-select"
            disabled={!isManager() || savingMemberPermissions()}
            id="channel-member-purpose-permission"
            onChange={(event) =>
              saveMemberPermission("purpose", event.currentTarget.value as PermissionChoice)
            }
            value={purposePermission()}
          >
            <option disabled value="">
              Choose a policy…
            </option>
            <option value="allow">All members</option>
            <option value="restrict">Channel managers only</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Message retention</div>
        <p class="channel-details-meta">
          The current retention policy isn’t exposed here. Choose a policy to apply an explicit
          change; saving posts a system message to the channel.
        </p>
        <div class="settings-row flex-between">
          <label class="settings-row-label" for="channel-retention-policy">
            New retention policy
          </label>
          <select
            class="channel-details-input channel-details-setting-select"
            disabled={!isManager() || savingRetention()}
            id="channel-retention-policy"
            onChange={(event) => setRetentionChoice(event.currentTarget.value as RetentionChoice)}
            value={retentionChoice()}
          >
            <option disabled value="">
              Choose a policy…
            </option>
            <option value="keep">Keep all messages</option>
            <option value="delete">Delete messages after…</option>
          </select>
        </div>
        <Show when={retentionChoice() === "delete"}>
          <div class="channel-details-retention-row flex-align-center">
            <input
              class="channel-details-input channel-details-retention-input"
              disabled={!isManager() || savingRetention()}
              min="1"
              onInput={(e) => setRetentionDays(Number(e.currentTarget.value) || 1)}
              onKeyDown={blurOnEnter}
              type="number"
              value={retentionDays()}
            />
            <span class="channel-details-meta">days</span>
          </div>
        </Show>
        <button
          class="settings-status-save channel-details-retention-save"
          disabled={!(isManager() && retentionDirty()) || savingRetention()}
          onClick={saveRetention}
          type="button"
        >
          {savingRetention() ? "Saving…" : "Save retention"}
        </button>
      </div>
    </>
  );
}
