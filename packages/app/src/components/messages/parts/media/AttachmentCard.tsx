import type { BlockActionContext } from "@slock/blockkit";
import {
  BlockKit,
  decodeTextEntities,
  EmojiText,
  LegacyAttachmentActions,
  Mrkdwn,
} from "@slock/blockkit";
import type { Attachment } from "@slock/slack-api";
import { ConstrainedImage, Icon, MediaFrame, VideoPlayer } from "@slock/ui";
import { For, Show } from "solid-js";
import { conversationDisplayName, store } from "../../../../lib/store";
import { MessageAuthorButton } from "../../message-author-buttons";
import "./AttachmentCard.css";
import MessageFiles from "./MessageFiles";
import { constrainMediaDimensions } from "./mediaDimensions";

const URL_SUFFIX_PATTERN = /[?#]/;

function isGifAttachment(attachment: Attachment) {
  if (!attachment.imageUrl || attachment.videoUrl) return false;
  return attachment.imageUrl.split(URL_SUFFIX_PATTERN)[0].toLowerCase().endsWith(".gif");
}

function AttachmentImage(props: { attachment: Attachment; large?: boolean }) {
  const a = props.attachment;
  const dimensions = () =>
    props.large
      ? constrainMediaDimensions(a.imageWidth, a.imageHeight, 360, 320, 360, 180, true)
      : constrainMediaDimensions(a.imageWidth, a.imageHeight, 240, 200, 240, 160, true);
  return (
    <Show when={a.imageUrl}>
      {(url) => (
        <ConstrainedImage
          alt=""
          class={`attachment-image${props.large ? " attachment-gif-image" : ""}`}
          height={dimensions().height}
          src={url()}
          width={dimensions().width}
        />
      )}
    </Show>
  );
}

function AttachmentContent(props: { attachment: Attachment; context?: BlockActionContext }) {
  const a = props.attachment;
  const bodyText = () => a.text || (a.actions?.length ? undefined : a.fallback);
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
            <BlockKit blocks={blocks()} context={props.context} />
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
        <AttachmentImage attachment={a} />
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
      ? store.channels.channelById(a.channelId)
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
  const locationLabel = () => {
    const label = location();
    return label.startsWith("#") ? label.slice(1) : label;
  };
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
    <div
      class="attachment-message-unfurl"
      style={{
        "--attachment-unfurl-color": a.color ? `#${a.color.replace("#", "")}` : "var(--text-dim)",
      }}
    >
      <Show when={a.authorName}>
        <div class="attachment-message-author flex-align-center">
          <Show when={a.authorIcon}>
            {(icon) => (
              <img alt="" class="attachment-message-author-icon" loading="lazy" src={icon()} />
            )}
          </Show>
          <MessageAuthorButton disabled name={a.authorName ?? ""} onClick={() => {}} />
        </div>
      </Show>
      <AttachmentContent attachment={a} />
      <Show when={a.channelId}>
        {(channelId) => (
          <div class="attachment-footer attachment-message-footer flex-align-center text-dim text-xs">
            <span>Posted in</span>
            <a
              class="attachment-channel-link flex-align-center"
              href={`/${channelId()}`}
              onClick={openConversation}
            >
              <Show when={channel()?.private} fallback={channel() ? "#" : undefined}>
                <Icon name="lock" size={11} />
              </Show>
              {locationLabel()}
            </a>
            <Show when={a.postedAt}>
              {(postedAt) => (
                <>
                  <span aria-hidden="true">|</span>
                  <span>{postedAt()}</span>
                </>
              )}
            </Show>
            <Show when={a.fromUrl}>
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

export default function AttachmentCard(props: {
  attachment: Attachment;
  showPermalink?: boolean;
  context?: BlockActionContext;
  isEphemeral?: boolean;
}) {
  const a = props.attachment;
  return (
    <>
      <Show when={isGifAttachment(a) ? undefined : a.pretext}>
        {(pretext) => (
          <div class="attachment-pretext">
            <Mrkdwn text={pretext()} />
          </div>
        )}
      </Show>
      <Show when={a.isMessageUnfurl && props.showPermalink && !a.channelId ? a.fromUrl : undefined}>
        {(url) => (
          <a
            class="attachment-message-link"
            href={decodeTextEntities(url())}
            rel="noopener noreferrer"
            target="_blank"
          >
            {decodeTextEntities(url())}
          </a>
        )}
      </Show>
      <Show
        fallback={
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
                <AttachmentContent attachment={a} context={props.context} />
                <Show when={a.actions?.length ? a.actions : undefined}>
                  {(actions) => (
                    <LegacyAttachmentActions
                      actions={actions()}
                      attachmentId={a.id}
                      callbackId={a.callbackId}
                      context={props.context}
                      isEphemeral={props.isEphemeral ?? false}
                    />
                  )}
                </Show>
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
            when={isGifAttachment(a)}
          >
            <MediaFrame title="GIF">
              <AttachmentImage attachment={a} large />
            </MediaFrame>
          </Show>
        }
        when={a.isMessageUnfurl}
      >
        <MessageUnfurl attachment={a} />
      </Show>
    </>
  );
}
