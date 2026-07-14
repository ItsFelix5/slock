import { emojiUrl } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { Avatar, Icon } from "@slock/ui";

export type UserSuggestItem = { kind: "user"; id: string; name: string; user: User };
export type ChannelSuggestItem = { kind: "channel"; id: string; name: string; private: boolean };
export type CommandSuggestItem = {
  kind: "command";
  name: string;
  desc: string;
  icon?: string | null;
};
export type EmojiSuggestItem = { kind: "emoji"; name: string; unicode?: string };
export type SuggestItem =
  | UserSuggestItem
  | ChannelSuggestItem
  | CommandSuggestItem
  | EmojiSuggestItem;

export type SuggestState =
  | { kind: "user"; start: number; items: UserSuggestItem[]; active: number }
  // Same user list as "user" — inserted as a link to the person's Slack
  // profile instead of a real @mention. See textDetection's "@/" trigger.
  | { kind: "userlink"; start: number; items: UserSuggestItem[]; active: number }
  | { kind: "channel"; start: number; items: ChannelSuggestItem[]; active: number }
  | { kind: "command"; start: number; items: CommandSuggestItem[]; active: number }
  | { kind: "emoji"; start: number; items: EmojiSuggestItem[]; active: number };

export function suggestItemContent(item: SuggestItem) {
  switch (item.kind) {
    case "user":
      return (
        <>
          <Avatar size="small" user={item.user} />
          <span class="composer-suggest-label">{item.name}</span>
        </>
      );
    case "channel":
      return (
        <>
          <span class="composer-suggest-icon flex-center">
            {item.private ? <Icon name="lock" size={12} /> : "#"}
          </span>
          <span class="composer-suggest-label">{item.name}</span>
        </>
      );
    case "command":
      return (
        <>
          <span class="composer-suggest-icon flex-center">
            {item.icon ? <img alt="" src={item.icon} /> : "/"}
          </span>
          <span class="composer-suggest-label">{item.name}</span>
          <span class="composer-suggest-desc">{item.desc}</span>
        </>
      );
    case "emoji": {
      const url = emojiUrl(item.name);
      return (
        <>
          <span class="composer-suggest-icon composer-suggest-emoji flex-center">
            {url ? <img alt="" src={url} /> : (item.unicode ?? "❔")}
          </span>
          <span class="composer-suggest-label">:{item.name}:</span>
        </>
      );
    }
  }
}
