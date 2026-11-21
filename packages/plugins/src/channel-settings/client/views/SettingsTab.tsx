import { service } from "@slock/core/solid";
import { isWaiting } from "@slock/resource";
import type { ChannelId } from "@slock/types";
import { Button } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import ChannelDangerZone from "./ChannelDangerZone";
import "@slock/plugins/channel-details/client/api/ChannelDetails.css";
import ChannelPostingPermissions from "./ChannelPostingPermissions";
import "./SettingsTab.css";
import {
  type AppliedRetentionChoice,
  type MemberPermissionKey,
  memberPermissionsDirty,
  memberPermissionsPatch,
  type PermissionChoice,
  retentionValue,
} from "../settings/channelPolicy";
import SettingsLoadError from "./SettingsLoadError";

const channelDetails = service("channel-details");

const feedback = service("feedback");

const DEFAULT_RETENTION_DAYS = 90;

type SavedRetention = { choice: AppliedRetentionChoice; days: number };

type RetentionChoice = "" | AppliedRetentionChoice;

function asPermissionChoice(value: string): PermissionChoice {
  return value === "allow" || value === "restrict" ? value : "";
}

function asRetentionChoice(value: string): RetentionChoice {
  return value === "keep" || value === "delete" ? value : "";
}

const PERMISSION_FIELDS: { key: MemberPermissionKey; label: string }[] = [
  { key: "invite", label: "Who can invite others" },
  { key: "topic", label: "Who can change the topic" },
  { key: "purpose", label: "Who can change the description" },
];

export default function SettingsTab(props: {
  archived: boolean;
  channelId: ChannelId;
  onChanged?: () => void;
  private: boolean;
}) {
  const permissionsQuery = channelDetails.createMemberPermissionsQuery(() => props.channelId);
  const [committedPermissions, setCommittedPermissions] = createSignal<
    Record<MemberPermissionKey, PermissionChoice>
  >(() => {
    const loaded = permissionsQuery().data;
    const choice = (allowed: boolean | undefined): PermissionChoice => {
      if (allowed === undefined) return "";
      return allowed ? "allow" : "restrict";
    };
    return {
      invite: choice(loaded?.invite),
      purpose: choice(loaded?.setPurpose),
      topic: choice(loaded?.setTopic),
    };
  });
  const [permissions, setPermissions] = createSignal(committedPermissions);

  const permissionDrafts = () => ({
    invite: { committed: committedPermissions().invite, current: permissions().invite },
    purpose: { committed: committedPermissions().purpose, current: permissions().purpose },
    topic: { committed: committedPermissions().topic, current: permissions().topic },
  });
  const permissionsDirty = () => memberPermissionsDirty(permissionDrafts());

  const retentionQuery = channelDetails.createChannelRetentionQuery(() => props.channelId);
  const retention = () => retentionQuery().data;
  const retryRetention = () =>
    void channelDetails.queries.retention.refresh(props.channelId).catch(() => {});

  const [savedRetention, setSavedRetention] = createSignal<SavedRetention | null>(
    (): SavedRetention | null => {
      const days = retention();
      if (days === undefined) return null;
      return days === null
        ? { choice: "keep", days: DEFAULT_RETENTION_DAYS }
        : { choice: "delete", days };
    },
  );
  const [retentionChoice, setRetentionChoice] = createSignal<RetentionChoice>(
    () => savedRetention()?.choice ?? "",
  );
  const [retentionDays, setRetentionDays] = createSignal(
    () => savedRetention()?.days ?? DEFAULT_RETENTION_DAYS,
  );

  const [saving, setSaving] = createSignal(false);

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
    setPermissions(committedPermissions());
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
      if (
        await channelDetails.updateMemberPermissions(
          props.channelId,
          memberPermissionsPatch(drafts),
        )
      ) {
        setCommittedPermissions({
          invite: drafts.invite.current,
          purpose: drafts.purpose.current,
          topic: drafts.topic.current,
        });
      } else {
        ok = false;
      }
    }

    if (retentionDirty()) {
      const choice = retentionChoice();
      const days = retentionDays();
      if (
        choice &&
        (await channelDetails.updateChannelRetention(props.channelId, retentionValue(choice, days)))
      ) {
        setSavedRetention({ choice, days });
      } else {
        ok = false;
      }
    }

    setSaving(false);
    if (ok) feedback.flash(props.channelId, "Settings updated.");
  };

  return (
    <>
      <ChannelPostingPermissions channelId={props.channelId} />

      <div class="settings-section">
        <div class="settings-section-title">Member permissions</div>
        <For each={PERMISSION_FIELDS}>
          {(field) => (
            <div class="settings-row flex-between">
              <label class="settings-row-label" for={`channel-member-${field.key}-permission`}>
                {field.label}
              </label>
              <select
                class="text-field select-field channel-details-setting-select"
                disabled={saving()}
                id={`channel-member-${field.key}-permission`}
                onChange={(event) =>
                  setPermissions((current) => ({
                    ...current,
                    [field.key]: asPermissionChoice(event.currentTarget.value),
                  }))
                }
                value={permissions()[field.key]}
              >
                <option disabled value="">
                  Choose a policy…
                </option>
                <option value="allow">All members</option>
                <option value="restrict">Channel managers only</option>
              </select>
            </div>
          )}
        </For>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Message retention</div>
        <Show when={retentionQuery().error}>
          <SettingsLoadError
            error={retentionQuery().error}
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
              class="text-field select-field channel-details-setting-select"
              disabled={retention() === undefined || saving()}
              id="channel-retention-policy"
              onChange={(event) => setRetentionChoice(asRetentionChoice(event.currentTarget.value))}
              value={retentionChoice()}
            >
              <option disabled value="">
                {isWaiting(retentionQuery()) ? "Loading…" : "Choose a policy…"}
              </option>
              <option value="keep">Keep all messages</option>
              <option value="delete">Delete after…</option>
            </select>
            <input
              class="text-field channel-details-retention-input"
              disabled={retentionChoice() !== "delete" || saving()}
              min="1"
              onInput={(e) => setRetentionDays(Math.trunc(Number(e.currentTarget.value)))}
              data-commit-on-enter
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
