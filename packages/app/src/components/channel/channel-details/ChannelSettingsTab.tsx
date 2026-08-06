import { Button } from "@slock/ui";
import { createMemo, createResource, createSignal, Show } from "solid-js";
import {
  loadChannelManagerIds,
  updateChannelRetention,
  updateMemberPermissions,
} from "../../../lib/channelDetails";
import { store } from "../../../lib/store";
import ChannelDangerZone from "./ChannelDangerZone";
import ChannelPostingPermissions from "./ChannelPostingPermissions";
import "../../settings/Settings.css";
import "./ChannelDetails.css";
import "./ChannelSettingsTab.css";
import {
  type AppliedPermissionChoice,
  type AppliedRetentionChoice,
  memberPermissionPatch,
  retentionValue,
} from "./settings/channelPolicy";

export default function ChannelSettingsTab(props: {
  archived: boolean;
  channelId: string;
  creatorId?: string;
  onChanged?: () => void;
  private: boolean;
}) {
  // admin.roles.entity.listAssignments (the source for managerIds) is an
  // Enterprise Grid org-admin API — it 404s/errors on every normal
  // workspace. Treat it as a bonus signal, not a requirement: workspace
  // admins/owners and the channel's creator can always manage a channel on
  // a non-Grid workspace, matching what Slack's own client falls back to.
  const [managerIds] = createResource(() => props.channelId, loadChannelManagerIds);
  const isManager = createMemo(() => {
    const me = store.users.currentUser();
    if (!me) return false;
    if (me.isWorkspaceAdmin) return true;
    if (props.creatorId && me.id === props.creatorId) return true;
    if (managerIds.error) return false;
    return (managerIds() ?? []).includes(me.id);
  });

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

  const retentionDaysValid = createMemo(
    () => Number.isInteger(retentionDays()) && retentionDays() >= 1,
  );

  const retentionDirty = createMemo(() => {
    const choice = retentionChoice();
    if (!choice) return false;
    if (choice === "delete" && !retentionDaysValid()) return false;
    const saved = savedRetention();
    return (
      !saved || choice !== saved.choice || (choice === "delete" && retentionDays() !== saved.days)
    );
  });

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
      <Show when={!(managerIds.loading || isManager())}>
        <p class="channel-details-meta">Only channel managers can change these settings.</p>
      </Show>

      <ChannelPostingPermissions channelId={props.channelId} isManager={isManager} />

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
              aria-invalid={!retentionDaysValid()}
              class="channel-details-input channel-details-retention-input"
              disabled={!isManager() || savingRetention()}
              min="1"
              onInput={(e) => setRetentionDays(Math.trunc(Number(e.currentTarget.value)))}
              onKeyDown={blurOnEnter}
              type="number"
              value={Number.isNaN(retentionDays()) ? "" : retentionDays()}
            />
            <span class="channel-details-meta">days</span>
          </div>
          <Show when={!retentionDaysValid()}>
            <p class="channel-details-meta channel-details-retention-invalid">
              Enter a whole number of days, 1 or greater.
            </p>
          </Show>
        </Show>
        <Button
          class="channel-details-retention-save"
          disabled={!(isManager() && retentionDirty()) || savingRetention()}
          onClick={saveRetention}
          variant="primary"
        >
          {savingRetention() ? "Saving…" : "Save retention"}
        </Button>
      </div>

      <ChannelDangerZone
        archived={props.archived}
        channelId={props.channelId}
        isManager={isManager}
        onChanged={props.onChanged}
        private={props.private}
      />
    </>
  );
}
