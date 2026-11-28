import type { VideoBlock } from "@slock/types";
import { imageSrc } from "@slock/ui";
import { Show } from "solid-js";
import BkText from "../BkText";
import { Link } from "../mrkdwn/mrkdwnTokens";
import { safeMediaUrl } from "../safeUrl";
import VideoEmbed from "../VideoEmbed";
import "./Video.css";

export default function Video(props: { block: VideoBlock }) {
  return (
    <article class="bk-video">
      <VideoEmbed
        thumbnailUrl={props.block.thumbnail_url}
        title={props.block.alt_text}
        url={props.block.video_url}
      />
      <div class="bk-video-info">
        <Show when={safeMediaUrl(props.block.provider_icon_url)}>
          {(url) => <img alt="" class="bk-video-provider-icon" src={imageSrc(url())} />}
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
