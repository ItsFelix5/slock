import { service } from "@slock/core/solid";
import type { Message, User } from "@slock/types";
import { createLatestValueSync } from "../../../query/client/api";
import { toggleReaction } from "../../../slack/client/api";
import type { MessageLocation } from "../lib/messageLocations";
import { addReactionUser, removeReactionUser } from "../lib/reactionList";

const feedback = service("feedback");

type ReactionWrite = {
  channelId: string;
  emojiName: string;
  reacted: boolean;
  seq: number;
  ts: string;
};

const SETTLED_ERRORS = new Set(["already_reacted", "no_reaction"]);

export function createMessageReactionToggle(deps: {
  currentUser: () => User | undefined;
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
}) {
  let seq = 0;
  const writeKey = (write: { channelId: string; ts: string; emojiName: string }) =>
    `${write.channelId}:${write.ts}:${write.emojiName}`;
  const latestSeq = new Map<string, number>();
  const currentReactions = (channelId: string, ts: string) =>
    deps.findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts)?.reactions;
  const withReaction = (
    reactions: Message["reactions"],
    emojiName: string,
    userId: string,
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

  async function reactToMessage(channelId: string, msg: Message, emojiName: string) {
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
