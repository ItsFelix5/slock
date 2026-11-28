import MessageFiles from "@slock/plugins/message-media/client/api/MessageFiles";
import { decodeTextEntities, mapFile } from "@slock/slack";
import type { CanvasCard, CanvasFile, CanvasImage, CanvasUnknown, FileId } from "@slock/types";
import { Show } from "solid-js";
import {
  type AtomEmbedValue,
  CARD_EMBED,
  COLUMNS_EMBED,
  type ColumnsEmbedValue,
  FILE_EMBED,
  IMAGE_EMBED,
  TABLE_EMBED,
  type TableEmbedValue,
  UNKNOWN_EMBED,
} from "../../lib/canvasEmbedValues";
import { createCanvasFileQuery } from "../../lib/canvasRequests";
import CanvasCardView from "./CanvasCardView";
import CanvasColumnsView from "./CanvasColumnsView";
import CanvasTableView from "./CanvasTableView";
import { defineCanvasEmbed } from "./defineCanvasEmbed";

function CanvasFileView(props: { fileId: FileId }) {
  const file = createCanvasFileQuery(() => props.fileId);
  return (
    <Show
      fallback={
        <Show when={file().status !== "loading"}>
          <div class="canvas-file-missing text-dim">This file is no longer available.</div>
        </Show>
      }
      when={file().data}
    >
      {(loaded) => <MessageFiles files={[mapFile(loaded())]} />}
    </Show>
  );
}

defineCanvasEmbed<ColumnsEmbedValue>({
  className: "canvas-columns-embed",
  name: COLUMNS_EMBED,
  view: CanvasColumnsView,
});

defineCanvasEmbed<TableEmbedValue>({
  className: "canvas-table-embed",
  name: TABLE_EMBED,
  view: CanvasTableView,
});

defineCanvasEmbed<AtomEmbedValue<CanvasImage>>({
  className: "canvas-image-embed",
  name: IMAGE_EMBED,
  view: (props) => {
    props.bind(() => props.value);
    return <CanvasFileView fileId={props.value.node.fileId} />;
  },
});

defineCanvasEmbed<AtomEmbedValue<CanvasFile>>({
  className: "canvas-file-embed",
  name: FILE_EMBED,
  view: (props) => {
    props.bind(() => props.value);
    return <CanvasFileView fileId={props.value.node.fileId} />;
  },
});

defineCanvasEmbed<AtomEmbedValue<CanvasCard>>({
  className: "canvas-card-embed",
  name: CARD_EMBED,
  view: (props) => {
    props.bind(() => props.value);
    return <CanvasCardView card={props.value.node} />;
  },
});

defineCanvasEmbed<AtomEmbedValue<CanvasUnknown>>({
  className: "canvas-unknown-embed",
  name: UNKNOWN_EMBED,
  view: (props) => {
    props.bind(() => props.value);
    return (
      <>
        <div class="text-dim">This block can only be edited in Slack.</div>
        {decodeTextEntities(props.value.node.text)}
      </>
    );
  },
});
