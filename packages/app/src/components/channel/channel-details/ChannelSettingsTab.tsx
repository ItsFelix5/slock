import { Button, blurOnEnter } from "@slock/ui";
import { createEffect, createMemo, createResource, createSignal, on, Show } from "solid-js";
import { actionFeedback } from "../../../lib/feedback";
import {
  loadChannelRetention,
  updateChannelRetention,
  updateMemberPermissions,
} from "../lib/channelDetails";
import "../../settings/Settings.css";
import ChannelDangerZone from "./ChannelDangerZone";
import "./ChannelDetails.css";
import ChannelPostingPermissions from "./ChannelPostingPermissions";
import "./ChannelSettingsTab.css";
import SettingsLoadError from "./SettingsLoadError";
import {
  type AppliedRetentionChoice,
  memberPermissionsDirty,
  memberPermissionsPatch,
  type PermissionChoice,
  retentionValue,
} from "./settings/channelPolicy";

type RetentionChoice = "" | AppliedRetentionChoice;

function asPermissionChoice(value: string): PermissionChoice {
  return value === "allow" || value === "restrict" ? value : "";
}

function asRetentionChoice(value: string): RetentionChoice {
  return value === "keep" || value === "delete" ? value : "";
}

export default function ChannelSettingsTab(props: {
  archived: boolean;
  channelId: string;
  onChanged?: () => void;
  private: boolean;
}) {
  const [invitePermission, setInvitePermission] = createSignal<PermissionChoice>("");
  const [committedInvite, setCommittedInvite] = createSignal<PermissionChoice>("");
  const [topicPermission, setTopicPermission] = createSignal<PermissionChoice>("");
  const [committedTopic, setCommittedTopic] = createSignal<PermissionChoice>("");
  const [purposePermission, setPurposePermission] = createSignal<PermissionChoice>("");
  const [committedPurpose, setCommittedPurpose] = createSignal<PermissionChoice>("");

  const permissionDrafts = () => ({
    invite: { committed: committedInvite(), current: invitePermission() },
    purpose: { committed: committedPurpose(), current: purposePermission() },
    topic: { committed: committedTopic(), current: topicPermission() },
  });
  const permissionsDirty = () => memberPermissionsDirty(permissionDrafts());

  const [retention, { refetch: refetchRetention }] = createResource(
    () => props.channelId,
    loadChannelRetention,
  );
  const retryRetention = () => void Promise.resolve(refetchRetention()).catch(() => {});

  const [retentionChoice, setRetentionChoice] = createSignal<RetentionChoice>("");
  const [retentionDays, setRetentionDays] = createSignal(90);
  const [savedRetention, setSavedRetention] = createSignal<{
    choice: AppliedRetentionChoice;
    days: number;
  } | null>(null);

  const [saving, setSaving] = createSignal(false);

  createEffect(
    on(retention, (days) => {
      if (days === undefined) return;
      const choice: AppliedRetentionChoice = days === null ? "keep" : "delete";
      setRetentionChoice(choice);
      setRetentionDays(days ?? retentionDays());
      setSavedRetention({ choice, days: days ?? retentionDays() });
    }),
  );

  const retentionDaysValid = () => Number.isInteger(retentionDays()) && retentionDays() >= 1;

  const retentionDirty = createMemo(() => {
    const choice = retentionChoice();
    if (!choice) return false;
    if (choice === "delete" && !retentionDaysValid()) return false;
    const saved = savedRetention();
    return (
      !saved || choice !== saved.choice || (choice === "delete" && retentionDays() !== saved.days)
    );
  });

  const anyDirty = () => permissionsDirty() || retentionDirty();

  const discardChanges = () => {
    setInvitePermission(committedInvite());
    setTopicPermission(committedTopic());
    setPurposePermission(committedPurpose());
    const saved = savedRetention();
    if (saved) {
      setRetentionChoice(saved.choice);
      setRetentionDays(saved.days);
    }
  };

  const saveChanges = async () => {
    if (saving()) return;
    setSaving(true);
    let ok = true;

    if (permissionsDirty()) {
      const drafts = permissionDrafts();
      if (await updateMemberPermissions(props.channelId, memberPermissionsPatch(drafts))) {
        setCommittedInvite(drafts.invite.current);
        setCommittedTopic(drafts.topic.current);
        setCommittedPurpose(drafts.purpose.current);
      } else {
        ok = false;
      }
    }

    if (retentionDirty()) {
      const choice = retentionChoice();
      const days = retentionDays();
      if (choice && (await updateChannelRetention(props.channelId, retentionValue(choice, days)))) {
        setSavedRetention({ choice, days });
      } else {
        ok = false;
      }
    }

    setSaving(false);
    if (ok) actionFeedback.flash(props.channelId, "Settings updated.");
  };

  return (
    <>
      <ChannelPostingPermissions channelId={props.channelId} />

      <div class="settings-section">
        <div class="settings-row-label">Member permissions</div>
        <div class="settings-row flex-between">
          <label class="settings-row-label" for="channel-member-invite-permission">
            Who can invite others
          </label>
          <select
            class="channel-details-input channel-details-setting-select"
            disabled={saving()}
            id="channel-member-invite-permission"
            onChange={(event) => setInvitePermission(asPermissionChoice(event.currentTarget.value))}
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
            disabled={saving()}
            id="channel-member-topic-permission"
            onChange={(event) => setTopicPermission(asPermissionChoice(event.currentTarget.value))}
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
            disabled={saving()}
            id="channel-member-purpose-permission"
            onChange={(event) =>
              setPurposePermission(asPermissionChoice(event.currentTarget.value))
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
        <Show when={retention.error}>
          <SettingsLoadError
            error={retention.error}
            message="Retention policy couldn't be loaded."
            onRetry={retryRetention}
          />
        </Show>
        <div class="settings-row flex-between">
          <label class="settings-row-label" for="channel-retention-policy">
            Retention policy
          </label>
          <div class="channel-details-retention-row flex-align-center">
            <select
              class="channel-details-input channel-details-setting-select"
              disabled={retention() === undefined || saving()}
              id="channel-retention-policy"
              onChange={(event) => setRetentionChoice(asRetentionChoice(event.currentTarget.value))}
              value={retentionChoice()}
            >
              <option disabled value="">
                {retention.loading ? "Loading…" : "Choose a policy…"}
              </option>
              <option value="keep">Keep all messages</option>
              <option value="delete">Delete after…</option>
            </select>
            <input
              class="channel-details-input channel-details-retention-input"
              disabled={retentionChoice() !== "delete" || saving()}
              min="1"
              onInput={(e) => setRetentionDays(Math.trunc(Number(e.currentTarget.value)))}
              onKeyDown={blurOnEnter}
              type="number"
              value={Number.isNaN(retentionDays()) ? "" : retentionDays()}
            />
            <span class="channel-details-meta">days</span>
          </div>
        </div>
        <Show when={retentionChoice() === "delete" && !retentionDaysValid()}>
          <p class="channel-details-meta channel-details-retention-invalid">
            Enter a whole number of days, 1 or greater.
          </p>
        </Show>
      </div>

      <Show when={anyDirty()}>
        <div class="channel-details-save-bar flex-align-center">
          <span class="channel-details-save-hint text-dim">Unsaved changes</span>
          <Button disabled={saving()} onClick={discardChanges} size="sm">
            Discard
          </Button>
          <Button disabled={saving()} onClick={saveChanges} size="sm" variant="primary">
            {saving() ? "Saving…" : "Save"}
          </Button>
        </div>
      </Show>

      <ChannelDangerZone
        archived={props.archived}
        channelId={props.channelId}
        onChanged={props.onChanged}
        private={props.private}
      />
    </>
  );
}
