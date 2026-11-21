import { defineQuery } from "@slock/plugins/query/client/api";
import { apiGet } from "@slock/slack";

export interface SlashCommand {
  desc: string;
  icon: string | null;
  name: string;
}

export const slashCommands = defineQuery<null, SlashCommand[]>({
  load: async () => {
    const data = await apiGet<{ commands?: SlashCommand[] }>("/api/commands");
    if (!data.ok) throw new Error(data.error ?? "fetching commands failed");
    return data.commands ?? [];
  },
  name: "slashCommands",
});
