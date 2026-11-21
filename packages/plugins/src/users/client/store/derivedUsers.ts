import type { User, UserId } from "@slock/types";
import { snapshot } from "solid-js";

type Presence = "active" | "away";

type Entry = { source: User; presence?: Presence; nickname?: string; result: User };

export function createDerivedUsers(deps: {
  presenceOf: (id: UserId) => Presence | undefined;
  nicknameOf: (id: UserId) => string | undefined;
  withNickname: (user: User) => User;
}) {
  const entries = new Map<UserId, Entry>();
  return (id: UserId, known: User): User => {
    const presence = deps.presenceOf(id);
    const nickname = deps.nicknameOf(id);
    const source = snapshot(known);
    const cached = entries.get(id);
    if (
      cached &&
      cached.presence === presence &&
      cached.nickname === nickname &&
      cached.source === source
    )
      return cached.result;
    const result = deps.withNickname(presence ? { ...source, presence } : { ...source });
    entries.set(id, { nickname, presence, result, source });
    return result;
  };
}
