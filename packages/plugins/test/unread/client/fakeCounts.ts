import type { FakeEnv } from "@slock/core/testing";
import type { ChannelId, GatewayEvent, RawCountGroup } from "@slock/types";

type Post = { mention: boolean; ts: number };

const readPath = /^\/api\/channels\/([A-Z0-9]+)\/read$/;

const json = (body: object) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const stampOf = (value: number) => value.toFixed(6);

export function createFakeCounts(env: FakeEnv, ids: ChannelId[]) {
  const posts = new Map<ChannelId, Post[]>(ids.map((id) => [id, []]));
  const lastRead = new Map<ChannelId, number>(ids.map((id) => [id, 0]));
  let clock = 1_000_000;
  let release = () => {};
  const bootGate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const unreadPosts = (id: ChannelId) =>
    (posts.get(id) ?? []).filter((post) => post.ts > (lastRead.get(id) ?? 0));
  const unread = (id: ChannelId) => unreadPosts(id).length;
  const mentions = (id: ChannelId) => unreadPosts(id).filter((post) => post.mention).length;

  const group = (id: ChannelId): RawCountGroup => ({
    id,
    last_read: stampOf(lastRead.get(id) ?? 0),
    latest: stampOf(posts.get(id)?.at(-1)?.ts ?? 0),
    mention_count_display: mentions(id),
    unread_count_display: unread(id),
  });

  env.fetch.respond(
    () => true,
    async ({ init, method, url }) => {
      const path = new URL(url, "http://slack.test").pathname;
      if (path === "/api/counts")
        return json({ notifications: {}, ok: true, unreads: { channels: ids.map(group) } });
      if (path === "/api/bootstrap") {
        await bootGate;
        return json({
          channels: ids.map((id) => ({ id, is_channel: true, name: id })),
          ok: true,
          self: { id: "UME", name: "me" },
          unreads: { channels: ids.map(group) },
        });
      }
      const read = readPath.exec(path);
      if (read?.[1] && method === "POST" && typeof init?.body === "string") {
        const id = ids.find((candidate) => candidate === read[1]);
        const { ts } = JSON.parse(init.body);
        if (id) lastRead.set(id, Math.max(lastRead.get(id) ?? 0, Number(ts)));
        return json({ ok: true });
      }
      return json({ error: "not_found", ok: false });
    },
  );

  return {
    releaseBootstrap: release,
    badgeEvent: (id: ChannelId): GatewayEvent => ({
      badges: { channels: [group(id)] },
      type: "badge_counts_updated",
    }),
    group,
    latest: (id: ChannelId) => posts.get(id)?.at(-1)?.ts,
    markedEvent: (id: ChannelId): GatewayEvent => ({
      channel: id,
      mention_count_display: mentions(id),
      ts: stampOf(lastRead.get(id) ?? 0),
      type: "channel_marked",
      unread_count_display: unread(id),
    }),
    mentions,
    post(id: ChannelId, mention: boolean) {
      clock += 1;
      posts.get(id)?.push({ mention, ts: clock });
      return clock;
    },
    readAll(id: ChannelId) {
      lastRead.set(id, posts.get(id)?.at(-1)?.ts ?? 0);
    },
    stampOf,
    unread,
  };
}
