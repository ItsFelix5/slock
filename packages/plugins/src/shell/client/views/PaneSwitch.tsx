import { getHost, service, usePoint } from "@slock/core/solid";
import { focusedPaneId, type Pane, useEscapeClose } from "@slock/ui";
import { createEffect, createMemo, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { PaneContent } from "../api/types";

export function paneTabLabel(pane: Pane<PaneContent | null>): JSX.Element {
  const { content } = pane;
  if (!content) return "…";
  const kind = getHost()
    .items("shell.pane")
    .find((item) => item.kind === content.kind);
  return kind?.tabLabel(content) ?? "…";
}

export default function PaneSwitch(props: { pane: Pane<PaneContent | null> }) {
  const panes = service("shell.panes");
  const view = service("shell.view");
  const kinds = usePoint("shell.pane");
  const resolvers = usePoint("shell.resolve");

  useEscapeClose(
    () => view.closeTile(props.pane.id),
    () => focusedPaneId() === props.pane.id,
  );

  const kind = createMemo(() => kinds().find((item) => item.kind === props.pane.content?.kind));
  const redirect = createMemo(() => {
    const { content } = props.pane;
    if (!content) return;
    for (const resolve of resolvers()) {
      const next = resolve(content);
      if (next) return next;
    }
  });
  createEffect(() => {
    const next = redirect();
    if (next) panes.setPaneContent(props.pane.id, next);
  });

  return (
    <Show when={!redirect() && kind()}>
      {(item) => <Dynamic component={item().view} pane={props.pane} />}
    </Show>
  );
}
