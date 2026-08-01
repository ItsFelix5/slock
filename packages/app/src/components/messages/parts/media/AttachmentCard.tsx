import { BlockKit, decodeTextEntities, EmojiText, Mrkdwn } from "@slock/blockkit";
import type { Attachment } from "@slock/slack-api";
import { VideoPlayer, ZoomableImage } from "@slock/ui";
import { For, Show } from "solid-js";
import { conversationDisplayName, store } from "../../../../lib/store";
import { MessageAuthorButton } from "../../MessageAuthorButtons";
import MessageFiles from "./MessageFiles";
import "./AttachmentCard.css";

function AttachmentContent(props: { attachment: Attachment }) {
  const a = props.attachment;
  const bodyText = () => a.text || a.fallback;
  return (
    <>
      <Show when={a.title}>
        <Show
          fallback={
            <div class="attachment-title">
              <Mrkdwn text={a.title ?? ""} />
            </div>
          }
          when={a.titleLink}
        >
          {(link) => (
            <a
              class="attachment-title attachment-title-link"
              href={decodeTextEntities(link())}
              rel="noopener noreferrer"
              target="_blank"
            >
              <EmojiText text={a.title ?? ""} />
            </a>
          )}
        </Show>
      </Show>
      <Show
        fallback={
          <Show when={bodyText()}>
            {(text) => (
              <div class="attachment-text">
                <Mrkdwn text={text()} />
              </div>
            )}
          </Show>
        }
        when={a.blocks?.length ? a.blocks : undefined}
      >
        {(blocks) => (
          <div class="attachment-text">
            <BlockKit blocks={blocks()} />
          </div>
        )}
      </Show>
      <Show when={a.fields?.length}>
        <div class="attachment-fields">
          <For each={a.fields}>
            {(f) => (
              <div class="attachment-field" classList={{ short: f.short }}>
                <div class="attachment-field-title">
                  <Mrkdwn text={f.title} />
                </div>
                <div class="attachment-field-value">
                  <Mrkdwn text={f.value} />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={a.videoUrl}>
        {(url) => (
          <VideoPlayer
            ariaLabel={a.title || "Embedded video"}
            class="attachment-video"
            height={a.videoHeight}
            openHref={url()}
            src={url()}
            width={a.videoWidth}
          />
        )}
      </Show>
      <Show when={!a.videoUrl && a.imageUrl}>
        {(url) => (
          <ZoomableImage
            alt=""
            class="attachment-image"
            height={a.imageHeight}
            reservedHeight={a.imageWidth && a.imageHeight ? undefined : 160}
            reservedWidth={a.imageWidth && a.imageHeight ? undefined : 240}
            src={url()}
            width={a.imageWidth}
          />
        )}
      </Show>
      <Show when={a.files?.length ? a.files : undefined}>
        {(files) => <MessageFiles files={files()} />}
      </Show>
    </>
  );
}

function MessageUnfurl(props: { attachment: Attachment }) {
  const a = props.attachment;
  const channel = () =>
    a.channelId && !a.channelId.startsWith("D")
      ? store.channels.knownChannelById(a.channelId)
      : undefined;
  const location = () =>
    a.channelId
      ? conversationDisplayName(
          a.channelId,
          channel(),
          store.dms.dmById(a.channelId),
          store.users.userById,
        )
      : "";
  const openConversation = (event: MouseEvent) => {
    if (
      !a.channelId ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    store.viewState.setActiveView({
      id: a.channelId,
      kind: a.channelId.startsWith("D") ? "dm" : "channel",
    });
  };

  return (
    <>
      <Show when={a.fromUrl}>
        {(url) => (
          <a class="attachment-message-link" href={url()} rel="noopener noreferrer" target="_blank">
            View message
          </a>
        )}
      </Show>
      <div class="attachment-message-unfurl">
        <div class="attachment-message-avatar message-avatar flex-center">
          <span aria-hidden="true">?</span>
          <Show when={a.authorIcon}>
            {(icon) => <img alt="" class="message-avatar-img" loading="lazy" src={icon()} />}
          </Show>
        </div>
        <div class="attachment-message-body">
          <Show when={a.authorName || a.postedAt}>
            <div class="message-meta">
              <Show when={a.authorName}>
                <MessageAuthorButton disabled name={a.authorName ?? ""} onClick={() => {}} />
              </Show>
              <Show when={a.postedAt}>
                {(postedAt) => <span class="message-time">{postedAt()}</span>}
              </Show>
            </div>
          </Show>
          <AttachmentContent attachment={a} />
          <Show when={a.channelId}>
            {(channelId) => (
              <div class="attachment-footer text-dim text-xs">
                Posted in{" "}
                <a
                  class="attachment-channel-link"
                  href={`/${channelId()}`}
                  onClick={openConversation}
                >
                  {location()}
                </a>
              </div>
            )}
          </Show>
        </div>
      </div>
    </>
  );
}

export default function AttachmentCard(props: { attachment: Attachment }) {
  const a = props.attachment;
  return (
    <>
      <Show when={a.pretext}>
        {(pretext) => (
          <div class="attachment-pretext">
            <Mrkdwn text={pretext()} />
          </div>
        )}
      </Show>
      <Show
        fallback={
          <div
            class="attachment-card"
            style={{
              "border-left-color": a.color
                ? `#${a.color.replace("#", "")}`
                : "var(--border-strong)",
            }}
          >
            <Show when={a.authorName}>
              <div class="attachment-author flex-align-center">
                <Show when={a.authorIcon}>
                  {(icon) => (
                    <img alt="" class="attachment-author-icon" loading="lazy" src={icon()} />
                  )}
                </Show>
                <Mrkdwn text={a.authorName ?? ""} />
              </div>
            </Show>
            <AttachmentContent attachment={a} />
            <Show when={a.footer}>
              <div class="attachment-footer flex-align-center text-dim text-xs">
                <Show when={a.footerIcon}>
                  {(icon) => (
                    <img alt="" class="attachment-footer-icon" loading="lazy" src={icon()} />
                  )}
                </Show>
                <Mrkdwn text={a.footer ?? ""} />
              </div>
            </Show>
          </div>
        }
        when={a.isMessageUnfurl}
      >
        <MessageUnfurl attachment={a} />
      </Show>
    </>
  );
}
