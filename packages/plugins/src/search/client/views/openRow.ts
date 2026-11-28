import { maybeService, service } from "@slock/core/solid";
import {
  openConversation,
  openConversationInSplit,
} from "@slock/plugins/conversations/client/api/nav";
import { isCanvasFile } from "@slock/plugins/files/client/api/fileSummary";
import {
  navigateToSlackPermalink,
  openSlackPermalinkInSplit,
} from "@slock/plugins/message-links/client/api/slackPermalink";
import type { ChannelId, SearchResult, SlackFile } from "@slock/types";
import type { OpenableRow } from "../engine/rows";

const dmsStore = service("dms");
const drafts = service("drafts");
const files = service("files");
const messageLinks = service("message-links");
const share = service("message-links.share");

const canvas = maybeService("canvas");
const usergroupDetails = maybeService("usergroup-details");

async function deliverShare(channelId: ChannelId) {
  const text = share.pendingShareText();
  if (!text) return;
  try {
    if (await drafts.seedDraft(channelId, undefined, text)) share.clearPendingShare();
  } catch (error) {
    console.error("Failed to share message", error);
  }
}

function openFile(file: SlackFile) {
  const canvasStore = canvas();
  if (canvasStore && isCanvasFile(file)) canvasStore.openCanvasPane(file.id, file.title);
  else files.open(file);
}

function openMessage({ channelId, threadTs, ts }: SearchResult, split: boolean) {
  const target = { channelId, messageTs: ts, threadTs: threadTs ?? ts };
  if (split) openSlackPermalinkInSplit(target, messageLinks);
  else navigateToSlackPermalink(target, messageLinks);
}

export async function openRow(row: OpenableRow, split: boolean): Promise<boolean> {
  switch (row.kind) {
    case "channel":
    case "dm":
      if (split) openConversationInSplit(row.id);
      else openConversation(row.id);
      void deliverShare(row.id);
      return true;
    case "person": {
      if (!(await dmsStore.openDmWithUser(row.user.id, { split }))) return false;
      const dmId = dmsStore.dmIdForUser(row.user.id);
      if (dmId) void deliverShare(dmId);
      return true;
    }
    case "usergroup":
      usergroupDetails()?.openUsergroupDetails(row.group.id);
      return true;
    case "file":
      openFile(row.file);
      return true;
    default:
      openMessage(row.message, split);
      return true;
  }
}
