import { Switch } from "@slock/ui";
import { createMemo, createResource, createSignal, Show } from "solid-js";
import {
  loadChannelManagerIds,
  updateChannelPostingPrefs,
  updateChannelRetention,
  updateMemberPermissions,
} from "../../../lib/channelDetails";
import { store } from "../../../lib/store";
import "../../settings/Settings.css";
import "./ChannelDetails.css";

export default function ChannelSettingsTab(props: { channelId: string; private: boolean }) {
  // These are all channel-manager-only actions on the real Slack client (the
  // API calls themselves would just reject a non-manager), so the controls
  // below are read-only until this resolves the current user as a manager.
  const [managerIds] = createResource(() => props.channelId, loadChannelManagerIds);
  const isManager = createMemo(() => {
    const me = store.users.currentUser()?.id;
    return !!me && (managerIds() ?? []).includes(me);
  });

  // There's no known read endpoint for channels.prefs.set,
  // conversations.setRetention or conversations.permissions.accountTypes.set —
  // all three are write-only as far as this relay can tell — so these toggles
  // start from Slack's ordinary defaults rather than reflecting this
  // channel's actual current configuration; each just applies a new value.
  const [postingRestricted, setPostingRestricted] = createSignal(false);
  const [threadsRestricted, setThreadsRestricted] = createSignal(false);
  const [allowChannelMentions, setAllowChannelMentions] = createSignal(true);
  // conversations.permissions.accountTypes.set's FULL_MEMBER `is_allowed` flags
  // are the same "channel managers only" restriction as who_can_post/can_thread
  // above — inverted here so every switch in this tab reads the same way
  // ("Only channel managers can ___", on = restricted).
  const [inviteRestricted, setInviteRestricted] = createSignal(false);
  const [topicRestricted, setTopicRestricted] = createSignal(false);
  const [purposeRestricted, setPurposeRestricted] = createSignal(false);

  // Retention changes post a visible system message to the channel, so
  // unlike the other toggles this doesn't auto-commit on change — it needs
  // an explicit Save so flipping the switch or editing the day count doesn't
  // spam the channel with a message per change.
  const [retentionEnabled, setRetentionEnabled] = createSignal(false);
  const [retentionDays, setRetentionDays] = createSignal(90);
  const [savedRetention, setSavedRetention] = createSignal({ days: 90, enabled: false });
  const [savingRetention, setSavingRetention] = createSignal(false);

  const retentionDirty = createMemo(() => {
    const saved = savedRetention();
    return (
      retentionEnabled() !== saved.enabled || (retentionEnabled() && retentionDays() !== saved.days)
    );
  });

  const savePostingPrefs = async (patch: {
    postingRestricted?: boolean;
    threadsRestricted?: boolean;
    allowChannelMentions?: boolean;
  }) => {
    const next = {
      allowChannelMentions: patch.allowChannelMentions ?? allowChannelMentions(),
      postingRestricted: patch.postingRestricted ?? postingRestricted(),
      threadsRestricted: patch.threadsRestricted ?? threadsRestricted(),
    };
    setPostingRestricted(next.postingRestricted);
    setThreadsRestricted(next.threadsRestricted);
    setAllowChannelMentions(next.allowChannelMentions);
    await updateChannelPostingPrefs(props.channelId, {
      allowChannelMentions: next.allowChannelMentions,
      postingRestrictedToManagers: next.postingRestricted,
      threadsRestrictedToManagers: next.threadsRestricted,
    });
  };

  const saveRetention = async () => {
    const enabled = retentionEnabled();
    const days = retentionDays();
    setSavingRetention(true);
    const ok = await updateChannelRetention(props.channelId, enabled ? days : null);
    if (ok) setSavedRetention({ days, enabled });
    setSavingRetention(false);
  };

  const saveMemberPermissions = async (patch: {
    inviteRestricted?: boolean;
    topicRestricted?: boolean;
    purposeRestricted?: boolean;
  }) => {
    const next = {
      inviteRestricted: patch.inviteRestricted ?? inviteRestricted(),
      purposeRestricted: patch.purposeRestricted ?? purposeRestricted(),
      topicRestricted: patch.topicRestricted ?? topicRestricted(),
    };
    setInviteRestricted(next.inviteRestricted);
    setTopicRestricted(next.topicRestricted);
    setPurposeRestricted(next.purposeRestricted);
    await updateMemberPermissions(props.channelId, {
      invite: !next.inviteRestricted,
      setPurpose: !next.purposeRestricted,
      setTopic: !next.topicRestricted,
    });
  };

  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") (e.currentTarget as HTMLElement).blur();
  };

  return (
    <>
      <Show when={managerIds.state === "ready" && !isManager()}>
        <p class="channel-details-meta">Only channel managers can change these settings.</p>
      </Show>

      <div class="settings-section">
        <div class="settings-row-label">Posting permissions</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Only channel managers can post</div>
          </div>
          <Switch
            checked={postingRestricted()}
            disabled={!isManager()}
            onChange={(v) => savePostingPrefs({ postingRestricted: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Only channel managers can reply in threads</div>
          </div>
          <Switch
            checked={threadsRestricted()}
            disabled={!isManager()}
            onChange={(v) => savePostingPrefs({ threadsRestricted: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Allow @channel and @here mentions</div>
          </div>
          <Switch
            checked={allowChannelMentions()}
            disabled={!isManager()}
            onChange={(v) => savePostingPrefs({ allowChannelMentions: v })}
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Member permissions</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Only channel managers can invite others</div>
          </div>
          <Switch
            checked={inviteRestricted()}
            disabled={!isManager()}
            onChange={(v) => saveMemberPermissions({ inviteRestricted: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Only channel managers can change the topic</div>
          </div>
          <Switch
            checked={topicRestricted()}
            disabled={!isManager()}
            onChange={(v) => saveMemberPermissions({ topicRestricted: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Only channel managers can change the description</div>
          </div>
          <Switch
            checked={purposeRestricted()}
            disabled={!isManager()}
            onChange={(v) => saveMemberPermissions({ purposeRestricted: v })}
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Message retention</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Automatically delete old messages</div>
            <div class="settings-row-hint text-dim">
              This posts a system message to the channel, so it isn't applied until you save.
            </div>
          </div>
          <Switch
            checked={retentionEnabled()}
            disabled={!isManager()}
            onChange={setRetentionEnabled}
          />
        </div>
        <Show when={retentionEnabled()}>
          <div class="channel-details-retention-row flex-align-center">
            <input
              class="channel-details-input channel-details-retention-input"
              disabled={!isManager()}
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
