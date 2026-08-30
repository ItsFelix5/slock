import { createStore, produce } from "solid-js/store";
import type { Message, Reaction, User } from "../../../api";
import { toggleReaction } from "../../../api";
import { actionFeedback } from "../../../feedback";
import { undoStack } from "../../../undo";
import type { MessageLocation } from "../types";

function restoreFailedReaction(
  current: Reaction[] | undefined,
  name: string,
  previous: Reaction | undefined,
  previousIndex: number,
): Reaction[] | undefined {
  const restored = (current ?? []).filter((reaction) => reaction.name !== name);
  if (previous) restored.splice(Math.min(previousIndex, restored.length), 0, previous);
  return restored.length ? restored : undefined;
}

export function createMessageReactionToggle(deps: {
  currentUser: () => User | undefined;
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
}) {
  const [reactionPending, setReactionPending] = createStore<Record<string, boolean>>({});
  const reactionPendingKey = (channelId: string, ts: string, emojiName: string) =>
    `${channelId}:${ts}:${emojiName}`;
  function isReactionPending(channelId: string, ts: string, emojiName: string): boolean {
    return !!reactionPending[reactionPendingKey(channelId, ts, emojiName)];
  }

  async function reactToMessage(channelId: string, msg: Message, emojiName: string) {
    const me = deps.currentUser();
    const pendingKey = reactionPendingKey(channelId, msg.ts, emojiName);
    if (!me || reactionPending[pendingKey]) return;
    setReactionPending(pendingKey, true);
    const previousReactions = msg.reactions;
    const reactions = previousReactions ?? [];
    const existing = reactions.find((r) => r.name === emojiName);
    const existingIndex = reactions.findIndex((r) => r.name === emojiName);
    const alreadyReacted = !!existing?.users.includes(me.id);
    let nextReactions: typeof reactions;
    if (alreadyReacted) {
      nextReactions = reactions
        .map((r) =>
          r.name === emojiName
            ? {
                ...r,
                count: r.count - 1,
                users: r.users.filter((u) => u !== me.id),
              }
            : r,
        )
        .filter((r) => r.count > 0);
    } else if (existing) {
      nextReactions = reactions.map((r) =>
        r.name === emojiName ? { ...r, count: r.count + 1, users: [...r.users, me.id] } : r,
      );
    } else {
      nextReactions = [...reactions, { count: 1, name: emojiName, users: [me.id] }];
    }
    deps.patchMessage(channelId, msg.ts, { reactions: nextReactions });
    try {
      await toggleReaction(channelId, msg.ts, emojiName, alreadyReacted);
      undoStack.push({
        label: alreadyReacted ? `remove :${emojiName}:` : `react :${emojiName}:`,
        undo: () => reactToMessage(channelId, { ...msg, reactions: nextReactions }, emojiName),
      });
    } catch (err) {
      console.error("Failed to toggle reaction", err);
      actionFeedback.flash(msg.ts, "Failed to update reaction.", "error");
      const current = deps
        .findAllMessageLocations(channelId, msg.ts)[0]
        ?.list.find((candidate) => candidate.ts === msg.ts)?.reactions;
      deps.patchMessage(channelId, msg.ts, {
        reactions: restoreFailedReaction(current, emojiName, existing, existingIndex),
      });
    } finally {
      setReactionPending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }

  return { isReactionPending, reactToMessage };
}
