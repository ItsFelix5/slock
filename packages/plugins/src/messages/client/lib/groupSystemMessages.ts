import type { Message } from "@slock/types";

const VERBS: Record<string, string> = {
  channel_join: "joined",
  channel_leave: "left",
  group_join: "joined",
  group_leave: "left",
};

const NAMED_USERS = 3;

function groupKey(message: Message): string | undefined {
  const verb = message.subtype && VERBS[message.subtype];
  return verb ? `${verb}:${message.day}` : undefined;
}

function summarize(run: Message[]): Message {
  const [first] = run as [Message, ...Message[]];
  const users = [...new Set(run.map((m) => m.userId))];
  const named = users.slice(0, NAMED_USERS).map((id) => `<@${id}>`);
  const hidden = users.length - named.length;
  const names =
    hidden > 0
      ? `${named.join(", ")} and ${hidden} other${hidden === 1 ? "" : "s"}`
      : named.length > 1
        ? `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`
        : (named[0] ?? "");
  const verb = VERBS[first.subtype ?? ""];
  return { ...first, text: `${names} ${verb} the channel` };
}

export function groupSystemMessages(messages: Message[]): Message[] {
  const result: Message[] = [];
  let run: Message[] = [];
  const flush = () => {
    const [only] = run;
    if (run.length === 1 && only) result.push(only);
    else if (run.length > 1) result.push(summarize(run));
    run = [];
  };
  for (const message of messages) {
    const key = groupKey(message);
    if (key && run[0] && groupKey(run[0]) === key) run.push(message);
    else {
      flush();
      if (key) run = [message];
      else result.push(message);
    }
  }
  flush();
  return result;
}
