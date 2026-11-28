import { IconButton } from "@slock/ui";
import { Show } from "solid-js";
import type { SearchRow } from "../../engine/rows";
import type { SearchSession } from "../../engine/session";
import MessageRow from "./MessageRow";
import RowButton from "./RowButton";
import RowContent from "./RowContent";

export default function ResultRow(props: {
  index: number;
  row: SearchRow;
  session: SearchSession;
}) {
  const { row } = props;
  const active = () => props.session.activeIndex() === props.index;
  const activate = (split: boolean) => props.session.activate(props.index, split);
  const hover = () => props.session.select(props.index);
  if (row.kind === "message") {
    return (
      <MessageRow
        active={active()}
        message={row.message}
        onActivate={activate}
        onHover={hover}
        session={props.session}
      />
    );
  }
  return (
    <div class="search-row-line flex-align-center">
      <RowButton
        active={active()}
        class={row.kind === "messages" ? "search-row-action" : undefined}
        onActivate={activate}
        onHover={hover}
      >
        <RowContent row={row} session={props.session} />
      </RowButton>
      <Show when={row.kind === "history"}>
        <IconButton
          class="search-row-remove"
          icon="close"
          onClick={() => {
            hover();
            props.session.removeActiveHistory();
          }}
          size="sm"
          tabindex={-1}
          tone="dim"
        />
      </Show>
    </div>
  );
}
