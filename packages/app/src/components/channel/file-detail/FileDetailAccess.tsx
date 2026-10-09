import type { SlackFile, SlackFileDetail, SlackFileShare } from "@slock/types";
import { AddRowButton, FloatingPanel, Icon } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import {
  type FileAccessTarget,
  removeFileAccess,
  setFileAccess,
  setFileOrgAccess,
} from "../../../lib/api";
import { flashCaughtError } from "../../../lib/feedback";
import { openConversationInSplit } from "../../../lib/navigation/conversationNav";
import ComposeChannelPicker from "../../composer/popovers/ComposeChannelPicker";
import ComposeUserPicker from "../../composer/popovers/ComposeUserPicker";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import AccessRow from "./AccessRow";
import { ACCESS_OPTIONS, ORG_ACCESS_OPTIONS } from "./accessLevels";
import UserChip from "./UserChip";

function uniqueChannelShares(shares: SlackFileShare[]): SlackFileShare[] {
  return [...new Map(shares.map((share) => [share.channelId, share])).values()];
}

export default function FileDetailAccess(props: {
  detail: SlackFileDetail;
  file: SlackFile;
  onChanged: () => void;
  onOpenShare: (share: SlackFileShare) => void;
}) {
  const [addRow, setAddRow] = createSignal<HTMLDivElement>();
  const [picking, setPicking] = createSignal<"channel" | "user" | null>(null);
  const access = () => props.detail.access;
  const channels = () => uniqueChannelShares(props.detail.shares);
  const orgId = () => access().orgId;
  const canManage = () =>
    props.detail.editable && props.file.filetype === "quip" && orgId() !== null;
  const hasRows = () => access().users.length > 0 || channels().length > 0;

  async function apply(task: Promise<void>) {
    setPicking(null);
    try {
      await task;
    } catch (error) {
      flashCaughtError(props.file.id, error, "Couldn't update access");
    }
    props.onChanged();
  }

  const grant = (target: FileAccessTarget, level: string) =>
    apply(setFileAccess(props.file.id, orgId() ?? "", target, level));

  const remove = (target: FileAccessTarget) => apply(removeFileAccess(props.file.id, target));

  const ownerFirst = () =>
    access().users.toSorted(
      (a, b) =>
        Number(b.userId === props.detail.ownerId) - Number(a.userId === props.detail.ownerId),
    );

  return (
    <Show when={canManage() || hasRows()}>
      <section class="file-detail-section">
        <Show when={orgId() && (canManage() || access().orgLevel !== "none")}>
          <AccessRow
            level={access().orgLevel}
            onLevel={
              canManage()
                ? (level) => void apply(setFileOrgAccess(props.file.id, orgId() ?? "", level))
                : undefined
            }
            options={ORG_ACCESS_OPTIONS}
          >
            <Icon name="workspace" size={16} />
            <span class="truncate">Everyone in workspace</span>
          </AccessRow>
        </Show>
        <For each={ownerFirst()}>
          {(entry) => {
            const isOwner = () => entry.userId === props.detail.ownerId;
            return (
              <AccessRow
                level={isOwner() ? "owner" : entry.access}
                onLevel={
                  canManage() && !isOwner()
                    ? (level) => void grant({ userId: entry.userId }, level)
                    : undefined
                }
                onRemove={
                  canManage() && !isOwner()
                    ? () => void remove({ userId: entry.userId })
                    : undefined
                }
                options={isOwner() ? [{ label: "Owner", value: "owner" }] : ACCESS_OPTIONS}
              >
                <UserChip userId={entry.userId} />
              </AccessRow>
            );
          }}
        </For>
        <For each={channels()}>
          {(share) => (
            <AccessRow
              level={share.access ?? "read"}
              onLevel={
                canManage()
                  ? (level) => void grant({ channelId: share.channelId }, level)
                  : undefined
              }
              onRemove={canManage() ? () => void remove({ channelId: share.channelId }) : undefined}
              options={ACCESS_OPTIONS}
            >
              <SplitNavigation onSplit={() => openConversationInSplit(share.channelId, share.ts)}>
                <button
                  class="file-detail-channel btn-reset flex-align-center"
                  onClick={() => props.onOpenShare(share)}
                  type="button"
                >
                  <Icon name="channel" size={16} />
                  <span class="truncate">{share.channelName}</span>
                </button>
              </SplitNavigation>
            </AccessRow>
          )}
        </For>
        <Show when={canManage()}>
          <div class="file-detail-add flex-align-center" ref={setAddRow}>
            <AddRowButton icon="user-add" label="Add people" onClick={() => setPicking("user")} />
            <AddRowButton
              icon="channel"
              label="Add channel"
              onClick={() => setPicking("channel")}
            />
          </div>
          <FloatingPanel anchor={addRow} class="file-detail-picker" open={picking() !== null}>
            <Show when={picking() === "user"}>
              <ComposeUserPicker
                excludeUserIds={access().users.map((entry) => entry.userId)}
                includeCurrentUser
                onClose={() => setPicking(null)}
                onSelect={(userId) => void grant({ userId }, "read")}
              />
            </Show>
            <Show when={picking() === "channel"}>
              <ComposeChannelPicker
                excludeChannelIds={channels().map((share) => share.channelId)}
                onClose={() => setPicking(null)}
                onSelect={(channelId) => void grant({ channelId }, "read")}
              />
            </Show>
          </FloatingPanel>
        </Show>
      </section>
    </Show>
  );
}
