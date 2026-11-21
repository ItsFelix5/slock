import { service } from "@slock/core/solid";
import type { ChannelId, Message, Ts, User, UserId } from "@slock/types";
import { createLatestValueSync } from "../../../query/client/api";
import { toggleReaction } from "../../../slack/client/api";
import type { LocatedMessages } from "../lib/messageLocations";
import { addReactionUser, removeReactionUser } from "../lib/reactionList";
import type { LiveChange } from "./history/liveChanges";

const feedback = service("feedback");

type ReactionWrite = {
  channelId: ChannelId;
  emojiName: string;
  reacted: boolean;
  seq: number;
  ts: Ts;
};

const SETTLED_ERRORS = new Set(["already_reacted", "no_reaction"]);

export function createMessageReactionToggle(deps: {
  currentUser: () => User | undefined;
  findAllMessageLocations: (channelId: ChannelId, ts: Ts) => LocatedMessages[];
  patchMessage: (channelId: ChannelId, ts: Ts, patch: Partial<Message>) => void;
  recordLiveChange: (change: LiveChange) => void;
}) {
  let seq = 0;
  const writeKey = (write: { channelId: ChannelId; ts: Ts; emojiName: string }) =>
    `${write.channelId}:${write.ts}:${write.emojiName}`;
  const latestSeq = new Map<string, number>();
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
      reactions: withReaction(base, emojiName, userId, reacted),
    });
  }
  const withReaction = (
    reactions: Message["reactions"],
    emojiName: string,
    userId: UserId,
    reacted: boolean,
  ) =>
    reacted
      ? addReactionUser(reactions ?? [], emojiName, userId)
      : removeReactionUser(reactions ?? [], emojiName, userId);

  const sync = createLatestValueSync<ReactionWrite>({
    key: writeKey,
    onError: (write, error) => {
      if (error instanceof Error && SETTLED_ERRORS.has(error.message)) return true;
      console.error("Failed to toggle reaction", error);
      feedback.error(write.ts, "Failed to update reaction.");
      const me = deps.currentUser();
      if (me)
        setReaction(
          write.channelId,
          write.ts,
          write.emojiName,
          me.id,
          !write.reacted,
          currentReactions(write.channelId, write.ts),
        );
      return false;
    },
    version: (write) => write.seq,
    write: async (write) => {
      await toggleReaction(write.channelId, write.ts, write.emojiName, !write.reacted);
    },
  });

  async function reactToMessage(channelId: ChannelId, msg: Message, emojiName: string) {
    const me = deps.currentUser();
    if (!me) return;
    const alreadyReacted = !!(currentReactions(channelId, msg.ts) ?? msg.reactions)
      ?.find((r) => r.name === emojiName)
      ?.users.includes(me.id);
    const reacted = !alreadyReacted;
    setReaction(
      channelId,
      msg.ts,
      emojiName,
      me.id,
      reacted,
      currentReactions(channelId, msg.ts) ?? msg.reactions,
    );
    const write = { channelId, emojiName, reacted, seq: ++seq, ts: msg.ts };
    const key = writeKey(write);
    latestSeq.set(key, write.seq);
    const synced = await sync.force(write);
    if (!synced || latestSeq.get(key) !== write.seq) return;
    latestSeq.delete(key);
    feedback.undo.push({
      label: reacted ? `react :${emojiName}:` : `remove :${emojiName}:`,
      undo: () => reactToMessage(channelId, msg, emojiName),
    });
  }

  return { reactToMessage };
}
