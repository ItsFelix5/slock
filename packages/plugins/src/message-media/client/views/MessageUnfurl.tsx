import { type BlockActionContext, safeColor, safeMediaUrl, safeUrl } from "@slock/blockkit";
import { decodeTextEntities } from "@slock/slack";
import type { Attachment, ChannelId, Message, Ts } from "@slock/types";
import { HideBrokenImage, Icon } from "@slock/ui";
import { Show } from "solid-js";
import { channelIconName } from "../../../channels/client/api";
import {
  openConversationInSplit,
  viewForConversation,
} from "../../../conversations/client/api/nav";
import { MessageAuthorButton } from "../../../messages/client/api/cards/MessageAuthorButton";
import { fetchMessagesByIds } from "../../../slack/client/api";
import "./AttachmentCard.css";
import { service } from "@slock/core/solid";
import { defineQuery } from "../../../query/client/api";
import AttachmentContent from "./AttachmentContent";

interface OriginalRef {
  channelId: ChannelId;
  ts: Ts;
}

const lookupOriginal = ({ channelId, ts }: OriginalRef) =>
  fetchMessagesByIds([{ channelId, ts }]).then((messages) => messages.get(`${channelId}:${ts}`));

const originalMessage = defineQuery<OriginalRef, Message | null>({
  load: async (ref) => (await lookupOriginal(ref)) ?? null,
  name: "originalMessage",
});
const viewStore = service("conversations");
const dmsStore = service("dms");
const channelsStore = service("channels");
const usersStore = service("users");
const titles = service("titles");

import { resolveAttachmentAuthorName } from "../../../messages/client/api/messageAuthor";

const hasInteractiveBlocks = (blocks: Attachment["blocks"]) =>
  !!blocks?.some(
    (block) => block.type === "actions" || (block.type === "section" && block.accessory),
  );

export default function MessageUnfurl(props: { attachment: Attachment }) {
  const a = props.attachment;
  const authorName = () => resolveAttachmentAuthorName(a, usersStore.userById);
  const dm = () => (a.channelId ? dmsStore.dmById(a.channelId) : undefined);
  const channel = () => (a.channelId && !dm() ? channelsStore.channelById(a.channelId) : undefined);
  const canViewMessage = () => {
    if (!a.channelId) return false;
    if (dmsStore.conversationKind(a.channelId) === "dm") return !!dm();
    const c = channel();
    return !c?.private || channelsStore.isChannelMember(c.id);
  };
  const location = () => (a.channelId ? titles.label(a.channelId) : "");
  const locationLabel = () => {
    const label = location();
    return label.startsWith("#") ? label.slice(1) : label;
  };
  const openConversation = (event: MouseEvent) => {
    if (!a.channelId || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey)
      return;
    event.preventDefault();
    if (event.shiftKey) {
      openConversationInSplit(a.channelId);
      return;
    }
    viewStore.setActiveView(viewForConversation(a.channelId));
  };
  const original = originalMessage.state(() => {
    const { channelId, ts } = a;
    return hasInteractiveBlocks(a.blocks) && channelId && ts ? { channelId, ts } : undefined;
  });
  const blockContext = (): BlockActionContext | undefined => {
    const message = original().data;
    if (!(message?.botId && a.channelId && a.ts)) return;
    return { botId: message.botId, channelId: a.channelId, messageTs: a.ts };
  };
  const openAuthorProfile = async () => {
    const { channelId, ts } = a;
    if (!(channelId && ts)) return;
    const userId = a.authorId ?? (await lookupOriginal({ channelId, ts }))?.userId;
    if (userId) usersStore.openUserProfile(userId);
  };

  return (
    <div
      class="attachment-message-unfurl"
      style={{
        "--attachment-unfurl-color": safeColor(a.color) ?? "var(--text-dim)",
      }}
    >
      <Show when={authorName()}>
        <div class="attachment-message-author flex-align-center">
          <Show when={safeMediaUrl(a.authorIcon)}>
            {(icon) => (
              <HideBrokenImage
                alt=""
                class="attachment-message-author-icon"
                loading="lazy"
                src={icon()}
              />
            )}
          </Show>
          <MessageAuthorButton
            disabled={!(a.channelId && a.ts)}
            name={authorName() ?? ""}
            onClick={openAuthorProfile}
            truncate
          />
        </div>
      </Show>
      <AttachmentContent attachment={a} context={blockContext()} isUnfurl />
      <Show when={a.channelId}>
        {(channelId) => (
          <div class="attachment-footer attachment-message-footer flex-align-center text-dim text-xs">
            <span>Posted in</span>
            <a
              class="attachment-channel-link flex-align-center"
              href={`/${encodeURIComponent(channelId())}`}
              onClick={openConversation}
            >
              <Show when={channel()}>
                {(c) => <Icon name={channelIconName(c().private)} size={11} />}
              </Show>
              <span class="truncate">{locationLabel()}</span>
            </a>
            <Show when={a.postedAt}>
              {(postedAt) => (
                <>
                  <span aria-hidden="true">|</span>
                  <span>{postedAt()}</span>
                </>
              )}
            </Show>
            <Show
              when={canViewMessage() ? safeUrl(decodeTextEntities(a.fromUrl ?? "")) : undefined}
            >
              {(url) => (
                <>
                  <span aria-hidden="true">|</span>
                  <a
                    class="attachment-view-message-link"
                    href={url()}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    View message
                  </a>
                </>
              )}
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
