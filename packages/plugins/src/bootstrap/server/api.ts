import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import { callSlack, type SlackReply } from "@slock/plugins/slack/server/api/slackClient";
import type { BootstrapPayload } from "@slock/types";

declare module "@slock/core/types" {
  interface Points {
    "bootstrap.part": BootstrapPart;
  }
}

type PartResult =
  | { ok: true; payload: BootstrapPayload }
  | { ok: false; error: string; retryAfter?: string };

type BootstrapPart = {
  name: string;
  optional?: boolean;
  required?: boolean;
  load(creds: Credentials | null): Promise<PartResult>;
};

export function slackPart<R extends object>(
  name: string,
  method: string,
  trim: (reply: R) => BootstrapPayload,
  options: { optional?: boolean; required?: boolean } = {},
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
    required: options.required,
  };
}
