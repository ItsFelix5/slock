import { Mrkdwn } from "@slock/blockkit";
import type { Attachment } from "@slock/slack-api";
import { ZoomableImage } from "@slock/ui";
import { For, Show } from "solid-js";
import "./AttachmentCard.css";

export default function AttachmentCard(props: { attachment: Attachment }) {
  const a = props.attachment;
  return (
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
          {a.authorName}
        </div>
      </Show>
      <Show when={a.title}>
        <Show fallback={<div class="attachment-title">{a.title}</div>} when={a.titleLink}>
          {(link) => (
            <a
              class="attachment-title attachment-title-link"
              href={link()}
              rel="noopener noreferrer"
              target="_blank"
            >
              {a.title}
            </a>
          )}
        </Show>
      </Show>
      <Show when={a.text}>
        {(text) => (
          <div class="attachment-text">
            <Mrkdwn text={text()} />
          </div>
        )}
      </Show>
      <Show when={a.fields?.length}>
        <div class="attachment-fields">
          <For each={a.fields}>
            {(f) => (
              <div class="attachment-field" classList={{ short: f.short }}>
                <div class="attachment-field-title">{f.title}</div>
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
          />
        )}
      </Show>
      <Show when={!a.videoUrl && a.imageUrl}>
        {(url) => <ZoomableImage alt="" class="attachment-image" src={url()} />}
      </Show>
      <Show when={a.footer}>
        <div class="attachment-footer flex-align-center text-dim text-xs">
          <Show when={a.footerIcon}>
            {(icon) => <img alt="" class="attachment-footer-icon" src={icon()} />}
          </Show>
          {a.footer}
        </div>
      </Show>
    </div>
  );
}
