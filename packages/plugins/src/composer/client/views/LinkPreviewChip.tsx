import { Mrkdwn, safeMediaUrl, safeUrl } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { resolveAttachmentAuthorName } from "@slock/plugins/messages/client/api/messageAuthor";
import { decodeTextEntities } from "@slock/slack";
import type { Attachment } from "@slock/types";
import { HideBrokenImage, IconButton } from "@slock/ui";
import { Show } from "solid-js";
import "./LinkPreviewChip.css";

const users = service("users");
const titles = service("titles");

const WWW_PREFIX = /^www\./;

const hostOf = (url: string | undefined) =>
  url && URL.canParse(url) ? new URL(url).hostname.replace(WWW_PREFIX, "") : undefined;

export default function LinkPreviewChip(props: { attachment: Attachment; onRemove: () => void }) {
  const a = props.attachment;
  const isMessage = !!a.isMessageUnfurl;
  const source = () =>
    isMessage
      ? resolveAttachmentAuthorName(a, users.userById)
      : a.serviceName || hostOf(a.fromUrl ?? a.titleLink);
  const sourceIcon = () => safeMediaUrl(isMessage ? a.authorIcon : a.serviceIcon);
  const meta = () =>
    isMessage ? [a.channelId && titles.label(a.channelId), a.postedAt].filter(Boolean) : [];
  const href = () => safeUrl(decodeTextEntities(a.titleLink ?? a.fromUrl ?? ""));
  const title = () => (isMessage ? undefined : a.title || hostOf(a.fromUrl));
  const body = () => a.text || (isMessage ? a.fallback : undefined);
  const image = () => (isMessage ? undefined : safeMediaUrl(a.imageUrl));
  return (
    <div class={["link-preview-chip", { "link-preview-message": isMessage }]}>
      <div class="link-preview-main">
        <div class="link-preview-source flex-align-center">
          <Show when={sourceIcon()}>
            {(src) => (
              <HideBrokenImage alt="" class="link-preview-icon" loading="lazy" src={src()} />
            )}
          </Show>
          <span class="link-preview-source-name truncate">{source()}</span>
          <Show when={meta().length}>
            <span class="link-preview-meta truncate">{meta().join(" · ")}</span>
          </Show>
        </div>
        <Show when={title()}>
          {(text) => (
            <Show
              fallback={<span class="link-preview-title truncate">{text()}</span>}
              when={href()}
            >
              {(url) => (
                <a
                  class="link-preview-title truncate"
                  href={url()}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {text()}
                </a>
              )}
            </Show>
          )}
        </Show>
        <Show when={body()}>
          {(text) => (
            <div class="link-preview-body">
              <Mrkdwn text={text()} />
            </div>
          )}
        </Show>
      </div>
      <Show when={image()}>
        {(src) => <HideBrokenImage alt="" class="link-preview-image" loading="lazy" src={src()} />}
      </Show>
      <IconButton
        class="link-preview-remove icon-shift"
        icon="close"
        label="Remove"
        onClick={props.onRemove}
        size="sm"
      />
    </div>
  );
}
