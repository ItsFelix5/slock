import type { Services } from "@slock/core/types";
import type { User } from "@slock/types";
import { createRoot, flush } from "solid-js";
import { createFakeEnv, partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch, uid } from "../../../support/slack";

const CHANNEL = ch("C1");
export const ANA = uid("UANA");

export const person: User = partialService<User>({ id: ANA, name: "Ana" });

const MEMBERS = /\/members\?/;
const MANAGERS = /\/managers$/;

export const json = (body: object) => new Response(JSON.stringify(body));
export const refusal = (error: string) => new Response(JSON.stringify({ error }), { status: 400 });

export async function startMembers(
  options: {
    failManagers?: boolean;
    failPage?: (filter: string, load: number) => string | undefined;
    list?: HTMLElement;
    pages?: number;
  } = {},
) {
  const { failPage, list, pages = 1 } = options;
  let failManagers = options.failManagers ?? false;
  const env = createFakeEnv(1, 1_000_000);
  const loads: string[] = [];
  const failures: string[] = [];
  const rosters: string[] = [];
  env.fetch.respond(MEMBERS, (call) => {
    const filter = new URLSearchParams(call.url.split("?")[1]).get("filter") ?? "";
    loads.push(filter);
    const load = loads.filter((f) => f === filter).length;
    const error = failPage?.(filter, load);
    if (error) return refusal(error);
    return json({ next_marker: load < pages ? `page${load}` : "", results: [] });
  });
  env.fetch.respond(MANAGERS, () =>
    failManagers ? refusal("no_permission") : json({ userIds: [] }),
  );
  const host = await startQueryHost(env);
  const { channelManagers } = await import(
    "../../../../packages/plugins/src/channels/client/store/queries"
  );
  await host.register({
    id: "services",
    setup: (ctx) => {
      ctx.provide(
        "shell.dialogs",
        partialService<Services["shell.dialogs"]>({ confirm: () => Promise.resolve(true) }),
      );
      ctx.provide(
        "channels",
        partialService<Services["channels"]>({
          channelManagersState: (id) => channelManagers.state(id),
          ensureChannelManagers: (id) => channelManagers.ensure(id),
          invalidateChannelRoster: (id) => void rosters.push(id),
          updateChannelManagers: (id, change) => channelManagers.overlay(id, change).commit(),
        }),
      );
      ctx.provide(
        "users",
        partialService<Services["users"]>({
          searchUsers: () => Promise.resolve([]),
          userById: () => person,
        }),
      );
      ctx.provide(
        "feedback",
        partialService<Services["feedback"]>({
          caught: (_key, _error, message) => void failures.push(message),
        }),
      );
    },
  });
  const { createChannelMembers } = await import(
    "../../../../packages/plugins/src/channel-members/client/channelMembers"
  );
  let changed = 0;
  const members = createRoot(() =>
    createChannelMembers({
      channelId: () => CHANNEL,
      channelName: () => "general",
      groupChat: () => false,
      list: () => list,
      memberCount: () => 0,
      onMembersChanged: () => changed++,
    }),
  );
  const settle = async () => {
    for (let i = 0; i < 20; i++) {
      await Bun.sleep(0);
      flush();
    }
  };
  await settle();
  return {
    changes: () => changed,
    env,
    failures,
    loads,
    members,
    recoverManagers: () => {
      failManagers = false;
    },
    rosters,
    settle,
  };
}
