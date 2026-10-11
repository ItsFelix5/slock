import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
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
    const fileId = channels.channelById(channelId)?.canvasFileId;
    return msg.canvasThreadId && fileId ? (
      <CommentQuote fileId={fileId} threadId={msg.canvasThreadId} />
    ) : undefined;
  });
  ctx.add("threads.header", (channelId) => {
    const fileId = channels.channelById(channelId)?.canvasFileId;
    return fileId
      ? { subtitle: () => <ThreadSubtitle fileId={fileId} />, title: "Comment" }
      : undefined;
  });
  ctx.add("shell.resolve", (content) => {
    if (content.kind !== "channel") return;
    const fileId = channels.channelById(content.id)?.canvasFileId;
    return fileId ? { fileId, kind: "canvas", title: canvas.canvasTitle(fileId) ?? "" } : undefined;
  });
};

export default setup;
