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
        <div class="attachment-author">
          <Show when={a.authorIcon}>
            {(icon) => <img class="attachment-author-icon" src={icon()} alt="" />}
          </Show>
          {a.authorName}
        </div>
      </Show>
      <Show when={a.title}>
        <Show when={a.titleLink} fallback={<div class="attachment-title">{a.title}</div>}>
          {(link) => (
            <a
              class="attachment-title attachment-title-link"
              href={link()}
              target="_blank"
              rel="noopener noreferrer"
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
            class="attachment-video"
            src={url()}
            controls
            width={a.videoWidth}
            height={a.videoHeight}
            aria-label={a.title || "Embedded video"}
            style={{ "max-width": "100%", height: "auto" }}
          />
        )}
      </Show>
      <Show when={!a.videoUrl && a.imageUrl}>
        {(url) => <ZoomableImage class="attachment-image" src={url()} alt="" />}
      </Show>
      <Show when={a.footer}>
        <div class="attachment-footer">
          <Show when={a.footerIcon}>
            {(icon) => <img class="attachment-footer-icon" src={icon()} alt="" />}
          </Show>
          {a.footer}
        </div>
      </Show>
    </div>
  );
}
