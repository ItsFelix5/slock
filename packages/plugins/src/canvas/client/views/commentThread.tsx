import { service } from "@slock/core/solid";
import type { ThreadOverride } from "@slock/plugins/threads/client/api";
import { hostedFileId } from "@slock/slack";
import type { ChannelId, Message } from "@slock/types";
import { commentResolving, peekCommentThread, setCommentResolved } from "../lib/canvasComments";
import ThreadSubtitle from "./ThreadSubtitle";

const canvas = service("canvas");

export function commentThread(
  channelId: ChannelId,
  root: Message | undefined,
): ThreadOverride | undefined {
  if (!root?.canvasComment) return;
  const { resolved: wasResolved } = root.canvasComment;
  const fileId = hostedFileId(channelId);
  const access = () => canvas.peekCanvasContent(fileId)?.access;
  const resolved = () => peekCommentThread(fileId, root.ts)?.archived ?? wasResolved;
  const disabled = () => commentResolving(fileId, root.ts);

  return {
    action() {
      const level = access();
      if (!level || level === "view" || resolved()) return;
      return {
        disabled: disabled(),
        label: "Resolve",
        run: () => setCommentResolved(fileId, root.ts, true),
      };
    },
    notice() {
      if (access() === "view") return { subject: "This canvas", text: "is view only." };
      if (!resolved()) return;
      return {
        action: {
          disabled: disabled(),
          icon: "undo",
          label: "Reopen",
          onClick: () => setCommentResolved(fileId, root.ts, false),
        },
        subject: "This comment",
        text: "is resolved.",
      };
    },
    subtitle: () => <ThreadSubtitle fileId={fileId} />,
    title: "Comment",
  };
}
