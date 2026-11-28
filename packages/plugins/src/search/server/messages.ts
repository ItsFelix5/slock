import { defined } from "@slock/core";
import { isHostedChannel } from "@slock/plugins/slack/server/api/trim/slackChannels";
import { trimAttachment, trimFile } from "@slock/plugins/slack/server/api/trim/slackMessages";
import { botIconOf, botTeamIdOf } from "@slock/slack";
import type { RawMessage } from "@slock/types";

const HIGHLIGHT_MARKER = /[\uE000\uE001]/;

type SearchMessageMatch = RawMessage & { permalink?: string };

export type MessageMatchGroup = {
  channel?: { id?: string; is_file?: boolean; name?: string; name_normalized?: string };
  messages?: SearchMessageMatch[];
};

function threadTsFromMatch(match: SearchMessageMatch): string | undefined {
  if (match.thread_ts) return match.thread_ts;
  if (!(match.permalink && URL.canParse(match.permalink))) return;
  return new URL(match.permalink).searchParams.get("thread_ts") || undefined;
}

function extractHighlights(raw: string): { highlights: string[]; text: string } {
  const [first, ...rest] = raw.split(HIGHLIGHT_MARKER);
  const highlights = new Set(rest.filter((_, index) => index % 2 === 0));
  return { highlights: [...highlights], text: defined(first) + rest.join("") };
}

export function searchResults(groups: MessageMatchGroup[]) {
  return groups.flatMap(({ channel, messages = [] }) => {
    const channelId = channel?.id;
    if (!(channelId && !isHostedChannel(channel))) return [];
    return messages.flatMap((match) => {
      if (!match.ts) return [];
      const { highlights, text } = extractHighlights(match.text ?? "");
      return [
        {
          attachments: match.attachments?.map(trimAttachment),
          blocks: match.blocks,
          botIcon: botIconOf(match),
          botId: match.bot_id,
          botName: match.username ?? match.bot_profile?.name,
          botTeamId: botTeamIdOf(match),
          channelId,
          channelName: channel.name ?? channelId,
          files: match.files?.map(trimFile),
          highlights,
          text,
          threadTs: threadTsFromMatch(match),
          ts: match.ts,
          userId: match.user ?? match.bot_id ?? "",
        },
      ];
    });
  });
}
