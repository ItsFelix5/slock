import { service } from "@slock/core/solid";
import ComposeChannelPicker from "@slock/plugins/composer/client/api/pickers/ComposeChannelPicker";
import ComposeUserPicker from "@slock/plugins/composer/client/api/pickers/ComposeUserPicker";
import type { SlackFile, SlackFileDetail, UserId } from "@slock/types";
import { AddRowButton, FloatingPanel, Icon } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { type AccessChange, fileAccess } from "../../fileMutations";
import type { FileAccessTarget } from "../../requests";
import AccessRow from "./AccessRow";
import { ACCESS_OPTIONS, ORG_ACCESS_ICONS, orgAccessOptions } from "./accessLevels";
import ChannelChip from "./ChannelChip";
import UserChip from "./UserChip";

const usersStore = service("users");

const EDIT_HELD_REASONS = {
  channel: "This person has edit access through a certain channel.",
  org: "Everyone in your organization has the ability to edit.",
};

type Access = NonNullable<SlackFileDetail["access"]>;

export default function FileDetailAccess(props: {
  detail: SlackFileDetail;
  file: SlackFile;
  onNavigate: () => void;
}) {
  const isEmpty = (access: Access) =>
    !(
      access.canManage ||
      access.users.length ||
      access.channels.length ||
      access.hiddenChannelCount
    ) && access.orgLevel === "none";

  return (
    <Show
      fallback={
        <section class="file-detail-section">
          <h3 class="file-detail-section-title">Access</h3>
          <span class="text-dim">Couldn't load access.</span>
        </section>
      }
      when={props.detail.access}
    >
      {(access) => (
        <Show when={!isEmpty(access())}>
          <AccessList
            access={access()}
            file={props.file}
            onNavigate={props.onNavigate}
            shares={props.detail.shares}
          />
        </Show>
      )}
    </Show>
  );
}

function AccessList(props: {
  access: Access;
  file: SlackFile;
  onNavigate: () => void;
  shares: SlackFileDetail["shares"];
}) {
  const [addRow, setAddRow] = createSignal<HTMLDivElement>();
  const [picking, setPicking] = createSignal<"channel" | "user" | null>(null);
  const canManage = () => props.access.canManage;
  const orgId = () => props.access.orgId;

  function apply(change: AccessChange) {
    setPicking(null);
    void fileAccess.run({ change, fileId: props.file.id });
  }

  const add = (target: FileAccessTarget) =>
    apply({ kind: "add", level: "read", orgId: orgId(), target });

  const rowActions = (target: FileAccessTarget) => ({
    onLevel: (level: string) => apply({ kind: "update", level, orgId: orgId(), target }),
    onRemove: () => apply({ kind: "revoke", orgId: orgId(), target }),
  });

  const isFixed = (userId: UserId, level: string) =>
    level === "owner" || userId === usersStore.currentUserId() || userId === props.file.userId;

  const ownerFirst = () =>
    props.access.users.toSorted(
      (a, b) => Number(b.access === "owner") - Number(a.access === "owner"),
    );

  return (
    <section class="file-detail-section">
      <h3 class="file-detail-section-title">Access</h3>
      <For each={ownerFirst()}>
        {(entry) => (
          <AccessRow
            {...(canManage() && !isFixed(entry.userId, entry.access)
              ? rowActions({ userId: entry.userId })
              : {})}
            editLockedReason={entry.editHeldBy && EDIT_HELD_REASONS[entry.editHeldBy]}
            level={entry.access}
            options={ACCESS_OPTIONS}
          >
            <UserChip userId={entry.userId} />
          </AccessRow>
        )}
      </For>
      <For each={props.access.channels}>
        {(entry) => (
          <AccessRow
            {...(canManage() && entry.access !== "owner"
              ? rowActions({ channelId: entry.channelId })
              : {})}
            editLockedReason={props.access.orgLevel === "write" ? EDIT_HELD_REASONS.org : undefined}
            level={entry.access}
            options={ACCESS_OPTIONS}
          >
            <ChannelChip
              channelId={entry.channelId}
              name={entry.name}
              onOpen={props.onNavigate}
              private={entry.private}
              share={props.shares.find((share) => share.channelId === entry.channelId)}
            />
          </AccessRow>
        )}
      </For>
      <Show when={props.access.hiddenChannelCount}>
        {(count) => (
          <div class="file-detail-access-row">
            <div class="file-detail-access-subject text-dim">
              <Icon name="lock" size={16} />
              {count() === 1 ? "1 other channel" : `${count()} other channels`}
            </div>
          </div>
        )}
      </Show>
      <Show when={canManage() || props.access.orgLevel !== "none"}>
        <AccessRow
          class="file-detail-access-general"
          level={props.access.orgLevel}
          onLevel={
            canManage() ? (level) => apply({ kind: "org", level, orgId: orgId() }) : undefined
          }
          options={orgAccessOptions(props.access.orgName)}
        >
          <Icon name={ORG_ACCESS_ICONS[props.access.orgLevel] ?? "globe"} size={16} />
        </AccessRow>
      </Show>
      <Show when={canManage()}>
        <div class="file-detail-add flex-align-center" ref={setAddRow}>
          <AddRowButton icon="user-add" label="Add people" onClick={() => setPicking("user")} />
          <AddRowButton icon="channel" label="Add channel" onClick={() => setPicking("channel")} />
        </div>
        <FloatingPanel anchor={addRow} class="file-detail-picker" open={picking() !== null}>
          <Show when={picking() === "user"}>
            <ComposeUserPicker
              excludeUserIds={props.access.users.map((entry) => entry.userId)}
              includeCurrentUser
              onClose={() => setPicking(null)}
              onSelect={(userId) => add({ userId })}
            />
          </Show>
          <Show when={picking() === "channel"}>
            <ComposeChannelPicker
              excludeChannelIds={props.access.channels.map((entry) => entry.channelId)}
              onClose={() => setPicking(null)}
              onSelect={(channelId) => add({ channelId })}
            />
          </Show>
        </FloatingPanel>
      </Show>
    </section>
  );
}
