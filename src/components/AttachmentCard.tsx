import { For, Show } from 'solid-js';
import type { Attachment } from '../types';
import { fileProxyUrl } from '../slackApi';
import Mrkdwn from '../blockkit/mrkdwn';
import './AttachmentCard.css';

// A slack-hosted image proxies through our cookie-authenticated file route;
// anything else (most link-unfurl previews) is a normal externally-hosted URL.
function imageSrc(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('.slack.com') || host.endsWith('.slack-files.com')) return fileProxyUrl(url);
  } catch {
    // relative or malformed URL; fall through to using it as-is
  }
  return url;
}

export default function AttachmentCard(props: { attachment: Attachment }) {
  const a = props.attachment;
  return (
    <div class="attachment-card" style={{ 'border-left-color': a.color ? `#${a.color.replace('#', '')}` : 'var(--border-strong)' }}>
      <Show when={a.authorName}>
        <div class="attachment-author">
          <Show when={a.authorIcon}>
            {(icon) => <img class="attachment-author-icon" src={icon()} alt="" />}
          </Show>
          {a.authorName}
        </div>
      </Show>
      <Show when={a.title}>
        <Show
          when={a.titleLink}
          fallback={<div class="attachment-title">{a.title}</div>}
        >
          {(link) => (
            <a class="attachment-title attachment-title-link" href={link()} target="_blank" rel="noopener noreferrer">
              {a.title}
            </a>
          )}
        </Show>
      </Show>
      <Show when={a.text}>
        <div class="attachment-text">
          <Mrkdwn text={a.text!} />
        </div>
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
      <Show when={a.imageUrl}>
        {(url) => <img class="attachment-image" src={imageSrc(url())} alt="" />}
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
