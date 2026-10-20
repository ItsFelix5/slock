import type { BlockActionContext } from "@slock/blockkit";
import { BlockKit, EmojiText, Mrkdwn } from "@slock/blockkit";
import { decodeTextEntities } from "@slock/slack";
import type { Attachment } from "@slock/types";
import { VideoPlayer } from "@slock/ui";
import { For, Show } from "solid-js";
import "./AttachmentCard.css";
import MessageFiles from "../api/MessageFiles";
import AttachmentImage from "./AttachmentImage";

export default function AttachmentContent(props: {
  attachment: Attachment;
  context?: BlockActionContext;
  isUnfurl?: boolean;
}) {
  const a = props.attachment;
  const bodyText = () => a.text || (props.isUnfurl || a.actions?.length ? undefined : a.fallback);
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
