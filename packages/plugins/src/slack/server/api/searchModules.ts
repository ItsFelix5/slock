import type { Credentials } from "./auth.ts";
import { callSlack } from "./slackClient.ts";

type SearchModuleReply<Item> = {
  items?: Item[];
  pagination?: { page_count?: number; total_count?: number };
};

export type SearchModuleRequest = {
  context: string;
  count: number;
  excludeBots?: boolean;
  myChannels?: boolean;
  page: number;
  query: string;
  sort: "score" | "timestamp";
  sortDir: "asc" | "desc";
};

export function searchModule<Item>(
  module: "files" | "messages",
  request: SearchModuleRequest,
  creds: Credentials | null,
) {
  return callSlack<SearchModuleReply<Item>>(
    `search.modules.${module}`,
    {
      count: String(request.count),
      extra_message_data: "1",
      extracts: "1",
      file_title_only: "false",
      highlight: "1",
      include_files_shares: "1",
      max_extract_len: "200",
      module,
      no_user_profile: "1",
      page: String(request.page),
      query: request.query,
      query_rewrite_disabled: "false",
      search_context: request.context,
      search_exclude_bots: String(!!request.excludeBots),
      search_only_my_channels: String(!!request.myChannels),
      sort: request.sort,
      sort_dir: request.sortDir,
      spell_correction: "FUZZY_MATCH",
    },
    creds,
  );
}
