import { emojiUrl } from "@slock/blockkit";
import { Avatar, Icon } from "@slock/ui";
import type { User } from "../../../lib/api";
import { channelIconName } from "../../../lib/displayName";

export type UserSuggestItem = {
  kind: "user";
  id: string;
  name: string;
  user: User;
  notInChannel?: boolean;
};
export type ChannelSuggestItem = {
  kind: "channel";
  id: string;
  name: string;
  private: boolean;
  notInChannel?: boolean;
};
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
  | { kind: "userlink"; start: number; items: UserSuggestItem[]; active: number }
  | { kind: "channel"; start: number; items: ChannelSuggestItem[]; active: number }
  | { kind: "command"; start: number; items: CommandSuggestItem[]; active: number }
  | { kind: "emoji"; start: number; items: EmojiSuggestItem[]; active: number };

export function suggestOpen(state: SuggestState | null): state is SuggestState {
  return !!state && state.items.length > 0;
}

export function suggestItemContent(item: SuggestItem) {
  switch (item.kind) {
    case "user":
      return (
        <>
          <Avatar size="small" user={item.user} />
          <span class="suggestion-label">{item.name}</span>
          {item.notInChannel ? <span class="suggestion-desc">not in channel</span> : null}
        </>
      );
    case "channel":
      return (
        <>
          <span class="suggestion-icon flex-center">
            <Icon name={channelIconName(item.private)} size={12} />
          </span>
          <span class="suggestion-label">{item.name}</span>
          {item.notInChannel ? <span class="suggestion-desc">not in channel</span> : null}
        </>
      );
    case "command":
      return (
        <>
          <span class="suggestion-icon flex-center">
            {item.icon ? <img alt="" src={item.icon} /> : "/"}
          </span>
          <span class="suggestion-label">{item.name}</span>
          <span class="suggestion-desc">{item.desc}</span>
        </>
      );
    case "emoji": {
      const url = emojiUrl(item.name);
      return (
        <>
          <span class="suggestion-icon composer-suggest-emoji flex-center">
            {url ? <img alt="" src={url} /> : (item.unicode ?? "❔")}
          </span>
          <span class="suggestion-label">:{item.name}:</span>
        </>
      );
    }
  }
}
