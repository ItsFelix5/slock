import type { BootstrapPayload } from "@slock/types";
import type { Credentials } from "../../slack/server/api/auth";
import { callSlack, type SlackReply } from "../../slack/server/api/slackClient";

declare module "@slock/core/types" {
  interface Points {
    "bootstrap.part": BootstrapPart;
  }
}

export type PartResult =
  | { ok: true; payload: BootstrapPayload }
  | { ok: false; error: string; retryAfter?: string };

export type BootstrapPart = {
  name: string;
  optional?: boolean;
  load(creds: Credentials | null): Promise<PartResult>;
};

export function slackPart<R extends object>(
  name: string,
  method: string,
  trim: (reply: R) => BootstrapPayload,
  options: { optional?: boolean } = {},
): BootstrapPart {
  return {
    load: async (creds) => {
      const reply: SlackReply<R> = await callSlack<R>(method, {}, creds).catch(
        (): SlackReply<R> => ({ error: `${name}_failed`, ok: false }),
      );
      return reply.ok
        ? { ok: true, payload: trim(reply) }
        : { error: reply.error || `${name} failed`, ok: false, retryAfter: reply.retry_after };
    },
    name,
    optional: options.optional,
  };
}
