import { firstTruthy } from "@slock/core";
import { getHost, service, usePoint } from "@slock/core/solid";
import { type Pane, useEscapeClose } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { dynamic } from "@solidjs/web";
import { createEffect, createMemo, onSettled } from "solid-js";
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

  onSettled(() => panes.markMounted(props.pane.id));
  useEscapeClose(
    () => view.closeTile(props.pane.id),
    () => panes.focusedPaneId() === props.pane.id,
  );

  const kind = createMemo(() => kinds().find((item) => item.kind === props.pane.content?.kind));
  const redirect = createMemo(() => {
    const { content } = props.pane;
    return content ? firstTruthy(resolvers(), (resolve) => resolve(content)) : undefined;
  });
  createEffect(redirect, (next) => {
    if (next) panes.setPaneContent(props.pane.id, next);
  });

  const View = dynamic(() => (redirect() ? undefined : kind()?.view));
  return <View pane={props.pane} />;
}
