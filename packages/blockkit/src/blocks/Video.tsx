import type { VideoBlock } from "@slock/types";
import { Icon } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import BkText from "../BkText";
import { Link } from "../mrkdwnTokens";
import { safeEmbedUrl, safeMediaUrl } from "../safeUrl";
import "./Video.css";

export default function Video(props: { block: VideoBlock }) {
  const [started, setStarted] = createSignal(false);
  const embedUrl = () => safeEmbedUrl(props.block.video_url);
  const posterImage = () => {
    const url = safeMediaUrl(props.block.thumbnail_url);
    return url ? `url(${JSON.stringify(url)})` : undefined;
  };

  return (
    <article class="bk-video">
      <div class="bk-video-frame">
        <Show
          fallback={
            <button
              aria-label={`Play ${props.block.alt_text || "video"}`}
              class="bk-video-poster flex-center btn-reset"
              onClick={() => setStarted(true)}
              style={{ "background-image": posterImage() }}
              type="button"
            >
              <span class="bk-video-play">
                <Icon name="play-filled" size={18} />
              </span>
            </button>
          }
          when={started() && embedUrl()}
        >
          {(url) => (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowfullscreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              src={url()}
              title={props.block.alt_text}
            />
          )}
        </Show>
      </div>
      <div class="bk-video-info">
        <Show when={safeMediaUrl(props.block.provider_icon_url)}>
          {(url) => <img alt="" class="bk-video-provider-icon" src={url()} />}
        </Show>
        <div class="bk-video-text flex-col">
          <Link
            class="bk-video-title truncate-lines"
            url={props.block.title_url ?? props.block.video_url}
          >
            <BkText text={props.block.title} />
          </Link>
          <Show when={props.block.provider_name || props.block.author_name}>
            <div class="text-muted text-sm">
              {[props.block.provider_name, props.block.author_name].filter(Boolean).join(" · ")}
            </div>
          </Show>
          <Show when={props.block.description}>
            <div class="text-muted text-sm truncate-lines">
              <BkText text={props.block.description} />
            </div>
          </Show>
        </div>
      </div>
    </article>
  );
}
