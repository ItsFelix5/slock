import { service } from "@slock/core/solid";
import { channelIconName } from "@slock/plugins/channels/client/api";
import { Avatar, AvatarStack, Icon } from "@slock/ui";
import type { SearchRow } from "../../engine/rows";
import type { SearchSession } from "../../engine/session";
import { readableQuery } from "../lib/pillLabels";
import FileSummary from "./FileSummary";

const titles = service("titles");
const usersStore = service("users");

export default function RowContent(props: {
  row: Exclude<SearchRow, { kind: "message" }>;
  session: SearchSession;
}) {
  const { row } = props;
  switch (row.kind) {
    case "channel":
      return (
        <>
          <span class="search-row-icon flex-center">
            <Icon name={channelIconName(row.private)} size={14} />
          </span>
          <span class="truncate">{row.name}</span>
        </>
      );
    case "person":
      return (
        <>
          <Avatar size="small" user={row.user} />
          <span class="truncate">{row.user.name}</span>
          <span class="search-row-meta text-dim truncate">
            {row.user.realName === row.user.name ? "" : row.user.realName}
          </span>
        </>
      );
    case "dm":
      return (
        <>
          <AvatarStack
            max={3}
            size="small"
            users={(row.dm.memberIds ?? []).flatMap((id) => usersStore.userById(id) ?? [])}
          />
          <span class="truncate">{titles.title(row.id)}</span>
        </>
      );
    case "usergroup":
      return (
        <>
          <span class="search-row-icon flex-center">
            <Icon name="user-groups" size={14} />
          </span>
          <span class="truncate">@{row.group.handle}</span>
          <span class="search-row-meta text-dim truncate">
            {row.group.title} · {row.group.memberCount}
          </span>
        </>
      );
    case "file":
      return <FileSummary file={row.file} />;
    case "messages":
      return (
        <>
          <span class="search-row-icon flex-center">
            <Icon name="search" size={14} />
          </span>
          <span class="truncate">Search messages for "{readableQuery(row.query)}"</span>
        </>
      );
    case "more": {
      const label = () => {
        if (props.session.loadingMore()) return "Loading more…";
        return props.session.moreFailed() ? "Couldn't load more. Try again" : "Load more";
      };
      return <span class="text-dim">{label()}</span>;
    }
    case "retry":
      return <span class="text-dim">Search failed. Try again</span>;
    default:
      return (
        <>
          <span class="search-row-icon flex-center">
            <Icon name="history" size={14} />
          </span>
          <span class="truncate">{readableQuery(row.entry.text)}</span>
        </>
      );
  }
}
