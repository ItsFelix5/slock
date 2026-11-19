import { service } from "@slock/core/solid";
import type { ChannelId, Message, Ts, User, UserId } from "@slock/types";
import { createLatestValueSync } from "../../../query/client/api";
import { toggleReaction } from "../../../slack/client/api";
import type { LocatedMessages } from "../lib/messageLocations";
import { addReactionUser, removeReactionUser } from "../lib/reactionList";

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
}) {
  let seq = 0;
  const writeKey = (write: { channelId: ChannelId; ts: Ts; emojiName: string }) =>
    `${write.channelId}:${write.ts}:${write.emojiName}`;
  const latestSeq = new Map<string, number>();
  const currentReactions = (channelId: ChannelId, ts: Ts) =>
    deps.findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts)?.reactions;
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
        deps.patchMessage(write.channelId, write.ts, {
          reactions: withReaction(
            currentReactions(write.channelId, write.ts),
            write.emojiName,
            me.id,
            !write.reacted,
          ),
        });
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
    const nextReactions = withReaction(
      currentReactions(channelId, msg.ts) ?? msg.reactions,
      emojiName,
      me.id,
      reacted,
    );
    deps.patchMessage(channelId, msg.ts, { reactions: nextReactions });
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
