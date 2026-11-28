import { defineQuery } from "@slock/plugins/query/client/api";
import { replyError } from "@slock/slack";
import { apiGet } from "@slock/slack/client";

interface SlashCommand {
  desc: string;
  icon: string | null;
  name: string;
}

export const slashCommands = defineQuery<null, SlashCommand[]>({
  load: async (_, { signal }) => {
    const data = await apiGet<{ commands?: SlashCommand[] }>("/api/commands", signal);
    if (!data.ok) throw replyError(data, "fetching commands failed");
    return data.commands ?? [];
  },
  name: "slashCommands",
});
