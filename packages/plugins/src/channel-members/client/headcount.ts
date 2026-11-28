import { service } from "@slock/core/solid";
import { defineQuery } from "@slock/plugins/query/client/api";
import type { ChannelId } from "@slock/types";
import { createEffect, createMemo } from "solid-js";
import { type ChannelPeople, fetchPeople, fetchPeopleCount } from "./requests";

const env = service("env");
const realtime = service("realtime");
const usersStore = service("users");

const PRESENCE_REFRESH_MS = 60_000;

const peopleCounts = defineQuery<ChannelId, number | null>({
  load: (id, { signal }) => fetchPeopleCount(id, signal),
  maxAgeMs: 5 * 60_000,
  name: "channelPeopleCounts",
});

const peopleLists = defineQuery<ChannelId, ChannelPeople>({
  load: (id, { signal }) => fetchPeople(id, signal),
  maxAgeMs: 10 * 60_000,
  name: "channelPeople",
});

export function refreshHeadcount(channelId: ChannelId) {
  peopleCounts.invalidate(channelId);
  // A sample of a big channel barely moves, and listing it again takes several requests.
  if (peopleLists.read(channelId)?.complete) peopleLists.invalidate(channelId);
}

export function createHeadcount(channelId: () => ChannelId | undefined) {
  const count = peopleCounts.state(channelId);
  const list = peopleLists.state(channelId);
  const people = () => count().data ?? undefined;
  const ids = createMemo(() => list().data?.ids);

  createEffect(
    () => ({ connected: realtime.gatewayConnected(), ids: ids() }),
    ({ connected, ids }) => {
      if (!(connected && ids?.length)) return;
      const ask = () => realtime.send({ ids, type: "query_presence" });
      ask();
      const timer = env.setInterval(ask, PRESENCE_REFRESH_MS);
      return () => env.clearInterval(timer);
    },
  );

  const online = createMemo(() => {
    const sample = list().data;
    if (!sample) return;
    const seen = sample.ids.map((id) => usersStore.knownPresence(id));
    if (seen.length && !seen.some(Boolean)) return;
    const active = seen.filter((presence) => presence === "active").length;
    if (sample.complete) return `${active}`;
    const total = people();
    return total === undefined ? undefined : `~${Math.round((total * active) / seen.length)}`;
  });

  return { online, people };
}
