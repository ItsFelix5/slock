import type { BlockActionContext } from "@slock/blockkit";
import { decodeTextEntities } from "@slock/blockkit";
import type { Attachment } from "@slock/types";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { channelIconName } from "../../../channels/client/api";
import {
  openConversationInSplit,
  viewForConversation,
} from "../../../conversations/client/api/nav";
import { MessageAuthorButton } from "../../../messages/client/api/cards/MessageAuthorButton";
import { createKeyedQuery } from "../../../query/client/api";
import { fetchMessagesByIds } from "../../../slack/client/api";
import "./AttachmentCard.css";
import { service } from "@slock/core/solid";
import { defineKey } from "../../../query/client/api";
import AttachmentContent from "./AttachmentContent";

const originalMessageKey = defineKey<[string, string]>("originalMessage");
const viewStore = service("conversations");
const dmsStore = service("dms");
const channelsStore = service("channels");
const usersStore = service("users");
const titles = service("titles");

import { resolveAttachmentAuthorName } from "../../../messages/client/api/messageAuthor";

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
  const lookupOriginal = (channelId: string, ts: string) =>
    fetchMessagesByIds([{ channelId, ts }]).then((messages) => messages.get(`${channelId}:${ts}`));
  const original = createKeyedQuery(() => {
    const { channelId, ts } = a;
    if (!(a.blocks?.length && channelId && ts)) return;
    return {
      queryFn: async () => (await lookupOriginal(channelId, ts)) ?? null,
      queryKey: originalMessageKey(channelId, ts),
    };
  });
  const blockContext = (): BlockActionContext | undefined => {
    const message = original.data;
    if (!(message?.botId && a.channelId && a.ts)) return;
    return { botId: message.botId, channelId: a.channelId, messageTs: a.ts };
  };
  const openAuthorProfile = async () => {
    const { channelId, ts } = a;
    if (!(channelId && ts)) return;
    const userId = (await lookupOriginal(channelId, ts))?.userId;
    if (userId) usersStore.openUserProfile(userId);
  };

  return (
    <div
      class="attachment-message-unfurl"
      style={{
        "--attachment-unfurl-color": a.color ? `#${a.color.replace("#", "")}` : "var(--text-dim)",
      }}
    >
      <Show when={authorName()}>
        <div class="attachment-message-author flex-align-center">
          <Show when={a.authorIcon}>
            {(icon) => (
              <img alt="" class="attachment-message-author-icon" loading="lazy" src={icon()} />
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
              href={`/${channelId()}`}
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
            <Show when={a.fromUrl && canViewMessage() ? a.fromUrl : undefined}>
              {(url) => (
                <>
                  <span aria-hidden="true">|</span>
                  <a
                    class="attachment-view-message-link"
                    href={decodeTextEntities(url())}
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
