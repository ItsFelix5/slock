import { emojiUrl } from "@slock/blockkit";
import { type Block, blockPreviewText, type SlackFile, type User } from "@slock/types";
import { Avatar, Icon, type IconName } from "@slock/ui";
import { channelIconName } from "../../../lib/displayName";

export type UserSuggestItem = {
  kind: "user";
  id: string;
  name: string;
  user: User;
  notInChannel?: boolean;
};
export type SpecialMentionSuggestItem = {
  kind: "special";
  id: "channel" | "here";
  name: string;
  description: string;
};
export type UsergroupSuggestItem = { kind: "usergroup"; id: string; name: string };
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
  iconName?: IconName;
};
export type EmojiSuggestItem = { kind: "emoji"; name: string; unicode?: string };
export type TemplateSuggestItem = {
  kind: "template";
  id: string;
  name: string;
  blocks: Block[];
  files?: SlackFile[];
};
export type SuggestItem =
  | UserSuggestItem
  | SpecialMentionSuggestItem
  | UsergroupSuggestItem
  | ChannelSuggestItem
  | CommandSuggestItem
  | EmojiSuggestItem
  | TemplateSuggestItem;

export type SuggestState =
  | {
      kind: "user";
      start: number;
      items: (UserSuggestItem | SpecialMentionSuggestItem | UsergroupSuggestItem)[];
      active: number;
    }
  | { kind: "userlink"; start: number; items: UserSuggestItem[]; active: number }
  | { kind: "channel"; start: number; items: ChannelSuggestItem[]; active: number }
  | { kind: "command"; start: number; items: CommandSuggestItem[]; active: number }
  | { kind: "emoji"; start: number; items: EmojiSuggestItem[]; active: number }
  | { kind: "template"; start: number; items: TemplateSuggestItem[]; active: number };

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
          {item.notInChannel ? <span class="suggestion-desc truncate">not in channel</span> : null}
        </>
      );
    case "special":
      return (
        <>
          <span class="suggestion-icon flex-center">
            <Icon name="megaphone" size={12} />
          </span>
          <span class="suggestion-label">{item.name}</span>
          <span class="suggestion-desc truncate">{item.description}</span>
        </>
      );
    case "channel":
      return (
        <>
          <span class="suggestion-icon flex-center">
            <Icon name={channelIconName(item.private)} size={12} />
          </span>
          <span class="suggestion-label">{item.name}</span>
          {item.notInChannel ? <span class="suggestion-desc truncate">not in channel</span> : null}
        </>
      );
    case "usergroup":
      return (
        <>
          <span class="suggestion-icon flex-center">
            <Icon name="user-groups" size={12} />
          </span>
          <span class="suggestion-label">{item.name}</span>
        </>
      );
    case "command":
      return (
        <>
          <span class="suggestion-icon flex-center">
            {item.iconName ? (
              <Icon name={item.iconName} size={12} />
            ) : item.icon ? (
              <img alt="" src={item.icon} />
            ) : (
              "/"
            )}
          </span>
          <span class="suggestion-label">{item.name}</span>
          <span class="suggestion-desc truncate">{item.desc}</span>
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
    case "template":
      return (
        <>
          <span class="suggestion-icon flex-center">
            <Icon name="bookmark-filled" size={12} />
          </span>
          <span class="suggestion-label">{item.name}</span>
          <span class="suggestion-desc truncate">{blockPreviewText(item.blocks)}</span>
        </>
      );
  }
}
