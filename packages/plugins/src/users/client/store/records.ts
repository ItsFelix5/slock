import { defineQuery } from "@slock/plugins/query/client/api";
import type { User, UserId } from "@slock/types";
import { createMemo } from "solid-js";
import type { UsersApi } from "./usersApi";

const MISSING_TTL_MS = 30_000;

type UserRecord = User | UserId | null;

const isUser = (record: UserRecord): record is User =>
  typeof record === "object" && record !== null;

export function sameUser(a: User | undefined, b: User | undefined): boolean {
  if (a === b) return true;
  if (!(a && b)) return false;
  const entries = Object.entries(a);
  return (
    entries.length === Object.keys(b).length &&
    entries.every(([key, value]) => Reflect.get(b, key) === value)
  );
}

export function createUserRecords(fetchUser: UsersApi["fetchUser"]) {
  const records = defineQuery<UserId, UserRecord>({
    gcMs: Number.POSITIVE_INFINITY,
    load: async (id, context) => {
      const user = await fetchUser(id, context);
      if (!user || user.id === id) return user;
      put(user);
      return user.id;
    },
    maxAgeMs: (record) => (record === null ? MISSING_TTL_MS : Number.POSITIVE_INFINITY),
    name: "users",
    revalidates: false,
  });

  const cached = () => records.values().filter(isUser);

  const idsByName = createMemo(() => {
    const ids = new Map<string, UserId>();
    for (const user of cached()) if (!ids.has(user.name)) ids.set(user.name, user.id);
    return ids;
  });

  function put(user: User): void {
    const current = records.read(user.id);
    if (current && isUser(current) && sameUser(current, user)) return;
    records.set(user.id, user);
  }

  function invalidate(id: UserId): void {
    if (records.read(id) === undefined) records.remove(id);
    else records.invalidate(id);
  }

  function isUnavailable(id: UserId): boolean {
    const { data, status } = records.entry(id);
    return data === null || (status === "error" && data === undefined);
  }

  return {
    cached,
    idByName: (name: string) => idsByName().get(name),
    invalidate,
    isUnavailable,
    peek: records.peek,
    put,
  };
}
