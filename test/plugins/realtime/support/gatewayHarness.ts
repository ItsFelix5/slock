import type {
  RealtimeEventHook,
  RealtimeTrim,
} from "../../../../packages/plugins/src/realtime/server/api";
import { createGateway } from "../../../../packages/plugins/src/realtime/server/gateway";
import type { Credentials } from "../../../../packages/plugins/src/slack/server/api/auth";
import { createFakeEnv } from "../../../support/core";
import { type FakeWebSocket, installFakeWebSocket } from "./fakeWebSocket";

export const creds: Credentials = {
  domain: "team.slack.com",
  route: "E1:T1",
  slackSession: "session-cookie",
  token: "xoxc-token",
};

type Gateway = ReturnType<typeof createGateway>;
type Client = { send(data: string): void };

export function watch(gateway: Gateway, client: Client, ids: unknown[]) {
  gateway.message(client, JSON.stringify({ ids, type: "watch_presence" }));
}

export function watchFiles(gateway: Gateway, client: Client, ids: unknown[]) {
  gateway.message(client, JSON.stringify({ ids, type: "watch_files" }));
}

export function greet(socket: FakeWebSocket) {
  socket.accept();
  socket.receive({ type: "hello" });
}

export function createGatewayHarness() {
  const fake = installFakeWebSocket();
  const env = { ...createFakeEnv(), random: () => 0.5 };
  const create = (hooks: RealtimeEventHook[] = [], trims: RealtimeTrim[] = []) =>
    createGateway(
      env,
      () => hooks,
      () => trims,
    );
  return {
    connect(hooks: RealtimeEventHook[] = [], trims: RealtimeTrim[] = []) {
      const gateway = create(hooks, trims);
      const received: Record<string, unknown>[] = [];
      const client = { send: (data: string) => void received.push(JSON.parse(data)) };
      gateway.open(client, creds);
      greet(fake.last());
      received.length = 0;
      return { client, gateway, received, slack: fake.last() };
    },
    create,
    env,
    fake,
  };
}
