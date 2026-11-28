import type { BlockActionContext } from "@slock/blockkit";
import { EmojiText, Mrkdwn, safeMediaUrl, safeUrl, VideoEmbed } from "@slock/blockkit";
import { decodeTextEntities } from "@slock/slack";
import type { Attachment } from "@slock/types";
import { Clamp, constrainMediaDimensions, VideoPlayer } from "@slock/ui";
import { For, Show } from "solid-js";
import "./AttachmentCard.css";
import MessageFiles from "../api/MessageFiles";
import AttachmentBlocks, { ATTACHMENT_LINES } from "./AttachmentBlocks";
import AttachmentImage from "./AttachmentImage";

export default function AttachmentContent(props: {
  attachment: Attachment;
  context?: BlockActionContext;
  isUnfurl?: boolean;
}) {
  const a = props.attachment;
  const showsMore = () =>
    props.isUnfurl ||
    a.actions?.length ||
    a.title ||
    a.fields?.length ||
    a.imageUrl ||
    a.videoUrl ||
    a.embedUrl ||
    a.files?.length;
  const bodyText = () => a.text || (showsMore() ? undefined : a.fallback);
  return (
    <>
      <Show when={a.title}>
        <Show
          fallback={
            <div class="attachment-title">
              <Mrkdwn text={a.title ?? ""} />
            </div>
          }
          when={safeUrl(decodeTextEntities(a.titleLink ?? ""))}
        >
          {(link) => (
            <a
              class="attachment-title attachment-title-link"
              href={link()}
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
              <Clamp class="attachment-text" lines={ATTACHMENT_LINES}>
                <Mrkdwn text={text()} />
              </Clamp>
            )}
          </Show>
        }
        when={a.blocks?.length ? a.blocks : undefined}
      >
        {(blocks) => <AttachmentBlocks blocks={blocks()} context={props.context} />}
      </Show>
      <Show when={a.fields?.length}>
        <Clamp lines={ATTACHMENT_LINES}>
          <div class="attachment-fields">
            <For each={a.fields}>
              {(f) => (
                <div class={["attachment-field", { short: f.short }]}>
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
        </Clamp>
      </Show>
      <Show
        fallback={
          <>
            <Show when={safeMediaUrl(a.videoUrl)}>
              {(url) => {
                const size = constrainMediaDimensions(
                  a.videoWidth,
                  a.videoHeight,
                  360,
                  320,
                  360,
                  202,
                );
                return (
                  <VideoPlayer
                    ariaLabel={a.title || "Embedded video"}
                    class="attachment-video"
                    height={size.height}
                    openHref={url()}
                    poster={a.imageUrl}
                    src={url()}
                    width={size.width}
                  />
                );
              }}
            </Show>
            <Show when={!a.videoUrl && a.imageUrl}>
              <AttachmentImage attachment={a} />
            </Show>
          </>
        }
        when={a.embedUrl}
      >
        {(url) => (
          <div class="attachment-embed">
            <VideoEmbed thumbnailUrl={a.imageUrl} title={a.title ?? ""} url={url()} />
          </div>
        )}
      </Show>
      <Show when={a.files?.length ? a.files : undefined}>
        {(files) => <MessageFiles files={files()} />}
      </Show>
    </>
  );
}
