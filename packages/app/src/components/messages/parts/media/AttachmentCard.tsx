import { BlockKit, decodeTextEntities, EmojiText, Mrkdwn } from "@slock/blockkit";
import type { Attachment } from "@slock/slack-api";
import { ZoomableImage } from "@slock/ui";
import { For, Show } from "solid-js";
import { channelDisplayName, store } from "../../../../lib/store";
import MessageFiles from "./MessageFiles";
import "./AttachmentCard.css";

export default function AttachmentCard(props: { attachment: Attachment }) {
  const a = props.attachment;
  const bodyText = () => a.text || a.fallback;
  const unfurlChannel = () => (a.channelId ? store.channels.channelById(a.channelId) : undefined);
  return (
    <>
      <Show when={a.pretext}>
        {(pretext) => (
          <div class="attachment-pretext">
            <Mrkdwn text={pretext()} />
          </div>
        )}
      </Show>
      <div
        class="attachment-card"
        style={{
          "border-left-color": a.color ? `#${a.color.replace("#", "")}` : "var(--border-strong)",
        }}
      >
        <Show when={a.authorName}>
          <div class="attachment-author flex-align-center">
            <Show when={a.authorIcon}>
              {(icon) => <img alt="" class="attachment-author-icon" src={icon()} />}
            </Show>
            <Mrkdwn text={a.authorName ?? ""} />
          </div>
        </Show>
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
            <video
              aria-label={a.title || "Embedded video"}
              class="attachment-video"
              controls
              height={a.videoHeight}
              src={url()}
              style={{ height: "auto", "max-width": "100%" }}
              width={a.videoWidth}
              preload="metadata"
            />
          )}
        </Show>
        <Show when={!a.videoUrl && a.imageUrl}>
          {(url) => <ZoomableImage alt="" class="attachment-image" src={url()} />}
        </Show>
        <Show when={a.files?.length ? a.files : undefined}>
          {(files) => <MessageFiles files={files()} />}
        </Show>
        <Show
          fallback={
            <Show when={a.footer}>
              <div class="attachment-footer flex-align-center text-dim text-xs">
                <Show when={a.footerIcon}>
                  {(icon) => <img alt="" class="attachment-footer-icon" src={icon()} />}
                </Show>
                <Mrkdwn text={a.footer ?? ""} />
              </div>
            </Show>
          }
          when={a.isMessageUnfurl && a.channelId ? a : undefined}
        >
          <div class="attachment-footer text-dim text-xs">
            Posted in #{channelDisplayName(unfurlChannel(), a.channelId)}
            <Show when={a.postedAt}> · {a.postedAt}</Show>
            <Show when={a.fromUrl}>
              {(url) => (
                <>
                  {" "}
                  ·{" "}
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
        </Show>
      </div>
    </>
  );
}
