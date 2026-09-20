import { resolveMediaUrl, type VideoBlock } from "@slock/types";
import { Icon } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import BkText from "../BkText";

export default function Video(props: { block: VideoBlock }) {
  const [started, setStarted] = createSignal(false);

  return (
    <article class="bk-video">
      <div class="bk-video-frame">
        <Show
          fallback={
            <button
              aria-label={`Play ${props.block.alt_text || "video"}`}
              class="bk-video-poster btn-reset"
              onClick={() => setStarted(true)}
              style={{ "background-image": `url(${resolveMediaUrl(props.block.thumbnail_url)})` }}
              type="button"
            >
              <span class="bk-video-play">
                <Icon name="play-filled" size={18} />
              </span>
            </button>
          }
          when={started()}
        >
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowfullscreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            src={props.block.video_url}
            title={props.block.alt_text}
          />
        </Show>
      </div>
      <div class="bk-video-info">
        <Show when={props.block.provider_icon_url}>
          {(url) => <img alt="" class="bk-video-provider-icon" src={resolveMediaUrl(url())} />}
        </Show>
        <div class="bk-video-text">
          <a
            class="bk-video-title"
            href={props.block.title_url ?? props.block.video_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <BkText text={props.block.title} />
          </a>
          <Show when={props.block.provider_name || props.block.author_name}>
            <div class="bk-video-provider">
              {[props.block.provider_name, props.block.author_name].filter(Boolean).join(" · ")}
            </div>
          </Show>
          <Show when={props.block.description}>
            <div class="bk-video-description">
              <BkText text={props.block.description} />
            </div>
          </Show>
        </div>
      </div>
    </article>
  );
}
