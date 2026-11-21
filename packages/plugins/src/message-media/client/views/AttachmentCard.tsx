import type { BlockActionContext } from "@slock/blockkit";
import {
  formatSlackDateTokens,
  LegacyAttachmentActions,
  Mrkdwn,
  safeColor,
  safeMediaUrl,
  safeUrl,
} from "@slock/blockkit";
import { decodeTextEntities } from "@slock/slack";
import type { Attachment } from "@slock/types";
import { HideBrokenImage, MediaFrame } from "@slock/ui";
import { Show } from "solid-js";
import "./AttachmentCard.css";
import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import AttachmentContent from "./AttachmentContent";
import AttachmentImage from "./AttachmentImage";
import MessageUnfurl from "./MessageUnfurl";

const URL_SUFFIX_PATTERN = /[?#]/;
const env = service("env");

function isGifAttachment(attachment: Attachment) {
  if (!attachment.imageUrl || attachment.videoUrl) return false;
  return defined(attachment.imageUrl.split(URL_SUFFIX_PATTERN)[0]).toLowerCase().endsWith(".gif");
}

function footerText(a: Attachment) {
  const date = a.ts ? formatSlackDateTokens("{date_short}", Number(a.ts), env.now()) : undefined;
  return [a.footer, date].filter(Boolean).join(" | ");
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
      <Show
        when={
          a.isMessageUnfurl && props.showPermalink && !a.channelId
            ? safeUrl(decodeTextEntities(a.fromUrl ?? ""))
            : undefined
        }
      >
        {(url) => (
          <a class="attachment-message-link" href={url()} rel="noopener noreferrer" target="_blank">
            {url()}
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
                  "border-left-color": safeColor(a.color) ?? "var(--border-strong)",
                }}
              >
                <Show when={a.authorName}>
                  <div class="attachment-author flex-align-center">
                    <Show when={safeMediaUrl(a.authorIcon)}>
                      {(icon) => (
                        <HideBrokenImage
                          alt=""
                          class="attachment-author-icon"
                          loading="lazy"
                          src={icon()}
                        />
                      )}
                    </Show>
                    <span class="truncate">
                      <Mrkdwn text={a.authorName ?? ""} />
                    </span>
                    <Show when={a.authorSubname}>
                      {(subname) => <span class="attachment-author-subname">{subname()}</span>}
                    </Show>
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
                <Show when={footerText(a)}>
                  <div class="attachment-footer flex-align-center text-dim text-xs">
                    <Show when={safeMediaUrl(a.footerIcon)}>
                      {(icon) => (
                        <HideBrokenImage
                          alt=""
                          class="attachment-footer-icon"
                          loading="lazy"
                          src={icon()}
                        />
                      )}
                    </Show>
                    <Mrkdwn text={footerText(a)} />
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
