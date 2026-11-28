import { list, record, type Session, text } from "./slack";

export type World = {
  self: string;
  users: string[];
  channels: string[];
  channelIds: Map<string, string>;
  emoji: string[];
  images: string[];
};

export async function loadWorld(session: Session): Promise<World> {
  const members = list(await session.call("users.list", { limit: 1000 }), "members");
  const channels = list(
    await session.call("conversations.list", {
      types: "public_channel,private_channel",
      limit: 1000,
    }),
    "channels",
  );
  const emoji = await session.call("emoji.list");
  return {
    self: session.userId,
    users: members.filter((m) => m.deleted !== true && m.is_bot !== true).map((m) => text(m, "id")),
    channels: channels.map((c) => text(c, "id")),
    channelIds: new Map(channels.map((c) => [text(c, "name"), text(c, "id")])),
    emoji: Object.keys(record(emoji, "emoji")),
    images: [],
  };
}
