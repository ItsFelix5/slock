import type { User } from "@slock/types";
import { unwrap } from "solid-js/store";

type Presence = "active" | "away";

type Entry = { source: User; presence?: Presence; nickname?: string; result: User };

export function createDerivedUsers(deps: {
  presenceOf: (id: string) => Presence | undefined;
  nicknameOf: (id: string) => string | undefined;
  withNickname: (user: User) => User;
}) {
  const entries = new Map<string, Entry>();
  return (id: string, known: User): User => {
    const presence = deps.presenceOf(id);
    const nickname = deps.nicknameOf(id);
    const source = unwrap(known);
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
