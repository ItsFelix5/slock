import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import HeaderCanvasMenu from "./views/HeaderCanvasMenu";

const setup: Setup = (ctx) => {
  ctx.add("messages.header", HeaderCanvasMenu, { order: 10 });
  const channels = service("channels");
  const canvas = service("canvas");
  ctx.add("channels.decorate", (channel) =>
    channel.canvasFileId
      ? { ...channel, name: canvas.canvasTitle(channel.canvasFileId) ?? channel.name }
      : channel,
  );
  ctx.add("shell.resolve", (content) => {
    if (content.kind !== "channel") return;
    const fileId = channels.channelById(content.id)?.canvasFileId;
    return fileId ? { fileId, kind: "canvas", title: canvas.canvasTitle(fileId) ?? "" } : undefined;
  });
};

export default setup;
