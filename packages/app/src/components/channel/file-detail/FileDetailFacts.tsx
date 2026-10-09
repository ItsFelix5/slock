import type { SlackFile, SlackFileDetail } from "@slock/types";
import { type JSX, Show } from "solid-js";
import { formatSize } from "../../messages/parts/media/FileCardInfo";
import { formatDateTime } from "./formatDateTime";

function Fact(props: { children: JSX.Element; label: string }) {
  return (
    <div class="file-detail-fact">
      <dt class="text-dim">{props.label}</dt>
      <dd>{props.children}</dd>
    </div>
  );
}

export default function FileDetailFacts(props: {
  detail: SlackFileDetail | undefined;
  file: SlackFile;
}) {
  const type = () =>
    [props.file.filetype?.toUpperCase(), formatSize(props.file.size)].filter(Boolean).join(" · ");

  return (
    <dl class="file-detail-facts">
      <Show when={props.file.created}>
        <Fact label="Created">{formatDateTime(props.file.created)}</Fact>
      </Show>
      <Show when={type()}>
        <Fact label="Type">{type()}</Fact>
      </Show>
      <Show when={props.detail?.viewerCount}>
        {(count) => <Fact label="Viewers">{count()}</Fact>}
      </Show>
    </dl>
  );
}
