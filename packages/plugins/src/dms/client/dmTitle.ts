import type { Points } from "@slock/core/types";
import type { DirectMessage, User } from "@slock/types";
import { isDmId } from "./api";

export function createDmTitleResolver(
  dmById: (id: string) => DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): Points["shell.title"] {
  function name(dm: DirectMessage | undefined): string {
    if (!dm) return "";
    if (dm.name) return dm.name;
    if (dm.userId) return userById(dm.userId)?.name ?? "";
    if (dm.memberIds?.length) {
      return dm.memberIds.map((id) => userById(id)?.name ?? "Someone").join(", ");
    }
    return "";
  }

  return (id) => {
    const dm = dmById(id);
    if (!isDmId(id, () => !!dm)) return;
    return { name: name(dm) || id };
  };
}
