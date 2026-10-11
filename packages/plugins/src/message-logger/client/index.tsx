import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { createLogFilters } from "./filters";
import EditedDiff from "./views/EditedDiff";
import FiltersTab from "./views/FiltersTab";

const setup: Setup = (ctx) => {
  const users = service("users");
  const filters = createLogFilters(() => users.currentUser()?.id);
  ctx.add("messages.retain", (msg) => !filters.ignores(msg));
  ctx.add("messages.edited", EditedDiff);
  ctx.add("messages.patch", (current, patch) =>
    patch.text !== undefined && patch.text !== current.text && !filters.ignores(current)
      ? { editHistory: [...(current.editHistory ?? []), current.text] }
      : undefined,
  );
  ctx.add("settings.tab", {
    id: "message-logger",
    label: "Message logger",
    view: () => <FiltersTab filters={filters} />,
  });
};

export default setup;
