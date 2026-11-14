import type { Credentials } from "../../slack/server/api/auth";
import type { RealtimeEventHook, RealtimeTrim } from "../server/api";
import { createGateway } from "../server/gateway";
import { installFakeWebSocket } from "./fakeWebSocket";

export const creds: Credentials = {
  domain: "team.slack.com",
  route: "E1:T1",
  slackSession: "session-cookie",
  token: "xoxc-token",
};

export type Gateway = ReturnType<typeof createGateway>;
type Client = { send(data: string): void };

export function watch(gateway: Gateway, client: Client, ids: unknown[]) {
  gateway.message(client, JSON.stringify({ ids, type: "watch_presence" }));
}

export function createGatewayHarness() {
  const fake = installFakeWebSocket();
  return {
    connect(hooks: RealtimeEventHook[] = [], trims: RealtimeTrim[] = []) {
      const gateway = createGateway(
        () => hooks,
        () => trims,
      );
      const received: Record<string, unknown>[] = [];
      const client = { send: (data: string) => void received.push(JSON.parse(data)) };
      gateway.open(client, creds);
      fake.last().accept();
      received.length = 0;
      return { client, gateway, received, slack: fake.last() };
    },
    fake,
  };
}
