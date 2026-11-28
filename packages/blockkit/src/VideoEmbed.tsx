import { Icon, imageSrc } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import { safeEmbedUrl, safeMediaUrl } from "./safeUrl";
import "./VideoEmbed.css";

export default function VideoEmbed(props: { url: string; thumbnailUrl?: string; title: string }) {
  const [started, setStarted] = createSignal(false);
  const embedUrl = () => safeEmbedUrl(props.url);
  const posterImage = () => {
    const url = imageSrc(safeMediaUrl(props.thumbnailUrl));
    return url ? `url(${JSON.stringify(url)})` : undefined;
  };

  return (
    <div class="bk-video-frame">
      <Show
        fallback={
          <button
            aria-label={`Play ${props.title || "video"}`}
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
            title={props.title}
          />
        )}
      </Show>
    </div>
  );
}
