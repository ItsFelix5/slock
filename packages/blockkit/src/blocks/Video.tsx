import { resolveMediaUrl, type VideoBlock } from "@slock/slack-api";
import { Show } from "solid-js";
import BkText from "../BkText";

export default function Video(props: { block: VideoBlock }) {
  return (
    <article class="bk-video">
      <div class="bk-video-frame">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowfullscreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          src={props.block.video_url}
          title={props.block.alt_text}
        />
      </div>
      <div class="bk-video-info">
        <Show when={props.block.provider_icon_url}>
          {(url) => <img alt="" class="bk-video-provider-icon" src={resolveMediaUrl(url())} />}
        </Show>
        <div>
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
