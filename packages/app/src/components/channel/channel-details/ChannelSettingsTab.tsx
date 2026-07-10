import { Switch } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import {
  updateChannelPostingPrefs,
  updateChannelRetention,
  updateMemberPermissions,
} from "../../../lib/channelDetails";
import "../../settings/Settings.css";
import "./ChannelDetails.css";

export default function ChannelSettingsTab(props: { channelId: string; private: boolean }) {
  // There's no known read endpoint for channels.prefs.set,
  // conversations.setRetention or conversations.permissions.accountTypes.set —
  // all three are write-only as far as this relay can tell — so these toggles
  // start from Slack's ordinary defaults rather than reflecting this
  // channel's actual current configuration; each just applies a new value.
  const [postingRestricted, setPostingRestricted] = createSignal(false);
  const [threadsRestricted, setThreadsRestricted] = createSignal(false);
  const [allowChannelMentions, setAllowChannelMentions] = createSignal(true);
  const [retentionEnabled, setRetentionEnabled] = createSignal(false);
  const [retentionDays, setRetentionDays] = createSignal(90);
  const [memberCanInvite, setMemberCanInvite] = createSignal(true);
  const [memberCanSetTopic, setMemberCanSetTopic] = createSignal(true);
  const [memberCanSetPurpose, setMemberCanSetPurpose] = createSignal(true);

  const savePostingPrefs = async (patch: {
    postingRestricted?: boolean;
    threadsRestricted?: boolean;
    allowChannelMentions?: boolean;
  }) => {
    const next = {
      postingRestricted: patch.postingRestricted ?? postingRestricted(),
      threadsRestricted: patch.threadsRestricted ?? threadsRestricted(),
      allowChannelMentions: patch.allowChannelMentions ?? allowChannelMentions(),
    };
    setPostingRestricted(next.postingRestricted);
    setThreadsRestricted(next.threadsRestricted);
    setAllowChannelMentions(next.allowChannelMentions);
    await updateChannelPostingPrefs(props.channelId, {
      postingRestrictedToManagers: next.postingRestricted,
      threadsRestrictedToManagers: next.threadsRestricted,
      allowChannelMentions: next.allowChannelMentions,
    });
  };

  const saveRetention = async () => {
    await updateChannelRetention(props.channelId, retentionEnabled() ? retentionDays() : null);
  };

  const saveMemberPermissions = async (patch: {
    invite?: boolean;
    setTopic?: boolean;
    setPurpose?: boolean;
  }) => {
    const next = {
      invite: patch.invite ?? memberCanInvite(),
      setTopic: patch.setTopic ?? memberCanSetTopic(),
      setPurpose: patch.setPurpose ?? memberCanSetPurpose(),
    };
    setMemberCanInvite(next.invite);
    setMemberCanSetTopic(next.setTopic);
    setMemberCanSetPurpose(next.setPurpose);
    await updateMemberPermissions(props.channelId, next);
  };

  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") (e.currentTarget as HTMLElement).blur();
  };

  return (
    <>
      <div class="channel-details-field">
        <div class="channel-details-label">Visibility</div>
        <p class="channel-details-value">
          {props.private
            ? "Private — only invited people can view this channel"
            : "Public — anyone in the workspace can join"}
        </p>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Posting permissions</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Only channel managers can post</div>
          </div>
          <Switch
            checked={postingRestricted()}
            onChange={(v) => savePostingPrefs({ postingRestricted: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Only channel managers can reply in threads</div>
          </div>
          <Switch
            checked={threadsRestricted()}
            onChange={(v) => savePostingPrefs({ threadsRestricted: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Allow @channel and @here mentions</div>
          </div>
          <Switch
            checked={allowChannelMentions()}
            onChange={(v) => savePostingPrefs({ allowChannelMentions: v })}
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Member permissions</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Members can invite others</div>
          </div>
          <Switch
            checked={memberCanInvite()}
            onChange={(v) => saveMemberPermissions({ invite: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Members can change the topic</div>
          </div>
          <Switch
            checked={memberCanSetTopic()}
            onChange={(v) => saveMemberPermissions({ setTopic: v })}
          />
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Members can change the description</div>
          </div>
          <Switch
            checked={memberCanSetPurpose()}
            onChange={(v) => saveMemberPermissions({ setPurpose: v })}
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Message retention</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Automatically delete old messages</div>
          </div>
          <Switch
            checked={retentionEnabled()}
            onChange={(v) => {
              setRetentionEnabled(v);
              saveRetention();
            }}
          />
        </div>
        <Show when={retentionEnabled()}>
          <div class="channel-details-retention-row">
            <input
              class="channel-details-input channel-details-retention-input"
              type="number"
              min="1"
              value={retentionDays()}
              onInput={(e) => setRetentionDays(Number(e.currentTarget.value) || 1)}
              onBlur={saveRetention}
              onKeyDown={blurOnEnter}
            />
            <span class="channel-details-meta">days</span>
          </div>
        </Show>
      </div>
    </>
  );
}
