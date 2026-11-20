import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { isChannelId } from "@slock/slack";
import CommentQuote from "./views/CommentQuote";
import HeaderCanvasMenu from "./views/HeaderCanvasMenu";
import ThreadSubtitle from "./views/ThreadSubtitle";

const setup: Setup = (ctx) => {
  ctx.add("messages.header", HeaderCanvasMenu, { order: 10 });
  const channels = service("channels");
  const canvas = service("canvas");
  ctx.add("channels.decorate", (channel) =>
    channel.canvasFileId
      ? { ...channel, name: canvas.canvasTitle(channel.canvasFileId) ?? channel.name }
      : channel,
  );
  ctx.add("messages.quote", (msg, channelId) => {
    if (!msg.canvasThreadId) return;
    const fileId = channels.channelById(channelId)?.canvasFileId;
    return fileId ? (
      <CommentQuote fileId={fileId} text={msg.text} threadId={msg.canvasThreadId} />
    ) : undefined;
  });
  ctx.add("threads.header", (channelId) => {
    const fileId = isChannelId(channelId)
      ? channels.channelById(channelId)?.canvasFileId
      : undefined;
    return fileId
      ? { subtitle: () => <ThreadSubtitle fileId={fileId} />, title: "Comment" }
      : undefined;
  });
  ctx.add("shell.resolve", (content) => {
    if (content.kind !== "channel" || !isChannelId(content.id)) return;
    const fileId = channels.channelById(content.id)?.canvasFileId;
    return fileId ? { fileId, kind: "canvas", title: canvas.canvasTitle(fileId) ?? "" } : undefined;
  });
};

export default setup;
