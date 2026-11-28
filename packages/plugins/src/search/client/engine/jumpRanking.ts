import type { BrowsableChannel, Channel, DirectMessage, User } from "@slock/types";
import { fuzzySearch } from "@slock/ui";
import { type JumpRow, personRow, rowKey } from "./rows";

interface JumpPool {
  channels: Pick<Channel, "id" | "name" | "private">[];
  groups: { dm: DirectMessage; title: string }[];
  remoteChannels: BrowsableChannel[];
  remoteUsers: User[];
  users: User[];
}

interface Candidate {
  alt: string;
  priority: number;
  remote: boolean;
  row: JumpRow;
  text: string;
}

const PRIORITY = { group: 1, joined: 2, unjoined: 0 };

function channelCandidate(
  { id, name, private: isPrivate }: Pick<Channel, "id" | "name" | "private">,
  remote: boolean,
): Candidate {
  return {
    alt: "",
    priority: remote ? PRIORITY.unjoined : PRIORITY.joined,
    remote,
    row: { id, kind: "channel", name, private: isPrivate },
    text: name,
  };
}

function userCandidate(user: User, remote: boolean): Candidate {
  return {
    alt: [user.realName, user.originalName].filter(Boolean).join(" "),
    priority: PRIORITY.joined,
    remote,
    row: personRow(user),
    text: user.name,
  };
}

export function rankJumps(
  term: string,
  pool: JumpPool,
  frecency: (row: JumpRow) => number,
): JumpRow[] {
  const candidates = new Map<string, Candidate>();
  const add = (candidate: Candidate) => {
    const key = rowKey(candidate.row);
    const existing = candidates.get(key);
    if (existing) existing.remote ||= candidate.remote;
    else candidates.set(key, candidate);
  };
  for (const channel of pool.channels) add(channelCandidate(channel, false));
  for (const channel of pool.remoteChannels) add(channelCandidate(channel, true));
  for (const user of pool.users) add(userCandidate(user, false));
  for (const user of pool.remoteUsers) add(userCandidate(user, true));
  for (const { dm, title } of pool.groups) {
    add({
      alt: "",
      priority: PRIORITY.group,
      remote: false,
      row: { dm, id: dm.id, kind: "dm" },
      text: title,
    });
  }
  const all = [...candidates.values()];
  const ranked = fuzzySearch(all, {
    altText: (candidate) => candidate.alt,
    frequency: (candidate) => frecency(candidate.row),
    priority: (candidate) => candidate.priority,
    query: term,
    text: (candidate) => candidate.text,
  });
  const matched = new Set(ranked);
  const serverOnly = all.filter((candidate) => candidate.remote && !matched.has(candidate));
  return [...ranked, ...serverOnly].map((candidate) => candidate.row);
}
