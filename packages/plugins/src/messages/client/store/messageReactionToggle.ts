import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import { isReactionSettled, toggleReaction } from "@slock/plugins/slack/client/api";
import { withReaction } from "@slock/slack";
import type { ChannelId, Message, Ts, User, UserId } from "@slock/types";
import type { LocatedMessages } from "../lib/messageLocations";
import type { LiveChange } from "./history/liveChanges";

const feedback = service("feedback");

type ReactionWrite = {
  channelId: ChannelId;
  emojiName: string;
  reacted: boolean;
  ts: Ts;
};

export function createMessageReactionToggle(deps: {
  currentUser: () => User | undefined;
  findAllMessageLocations: (channelId: ChannelId, ts: Ts) => LocatedMessages[];
  patchMessage: (channelId: ChannelId, ts: Ts, patch: Partial<Message>) => void;
  recordLiveChange: (change: LiveChange) => void;
}) {
  const writeKey = (write: ReactionWrite) => `${write.channelId}:${write.ts}:${write.emojiName}`;
  const newest = new Map<string, ReactionWrite>();
  const onServer = new Set<string>();
  const noteServer = (key: string, reacted: boolean) =>
    reacted ? onServer.add(key) : onServer.delete(key);
  const currentReactions = (channelId: ChannelId, ts: Ts) =>
    deps.findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts)?.reactions;
  function setReaction(
    channelId: ChannelId,
    ts: Ts,
    emojiName: string,
    userId: UserId,
    reacted: boolean,
    base: Message["reactions"],
  ) {
    deps.recordLiveChange({
      channelId,
      reaction: { added: reacted, name: emojiName, userId },
      ts,
    });
    deps.patchMessage(channelId, ts, {
      reactions: withReaction(base ?? [], emojiName, userId, reacted),
    });
  }

  const sync = defineMutation<ReactionWrite>({
    key: writeKey,
    mode: "latest",
    onError: (error, write) => {
      console.error("Failed to toggle reaction", error);
      feedback.error(write.ts, "Failed to update reaction.");
      const me = deps.currentUser();
      if (me)
        setReaction(
          write.channelId,
          write.ts,
          write.emojiName,
          me.id,
          onServer.has(writeKey(write)),
          currentReactions(write.channelId, write.ts),
        );
    },
    run: async (write) => {
      try {
        await toggleReaction(write.channelId, write.ts, write.emojiName, !write.reacted);
      } catch (error) {
        if (!isReactionSettled(error)) throw error;
      }
      noteServer(writeKey(write), write.reacted);
    },
  });

  async function reactToMessage(channelId: ChannelId, msg: Message, emojiName: string) {
    const me = deps.currentUser();
    if (!me) return;
    const alreadyReacted = !!(currentReactions(channelId, msg.ts) ?? msg.reactions)
      ?.find((r) => r.name === emojiName)
      ?.users.includes(me.id);
    const reacted = !alreadyReacted;
    const write = { channelId, emojiName, reacted, ts: msg.ts };
    const key = writeKey(write);
    if (!sync.pending(key)) noteServer(key, alreadyReacted);
    setReaction(
      channelId,
      msg.ts,
      emojiName,
      me.id,
      reacted,
      currentReactions(channelId, msg.ts) ?? msg.reactions,
    );
    newest.set(key, write);
    const synced = await sync.run(write);
    if (!synced || newest.get(key) !== write) return;
    newest.delete(key);
    feedback.undo.push({
      label: reacted ? `react :${emojiName}:` : `remove :${emojiName}:`,
      undo: () => reactToMessage(channelId, msg, emojiName),
    });
  }

  return { reactToMessage };
}
