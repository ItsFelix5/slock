import { service } from "@slock/core/solid";
import { Show } from "solid-js";
import SearchSurface from "./SearchSurface";

const searchStore = service("search");
const sidebarStore = service("sidebar");

export default function SearchScreen() {
  return (
    <Show keyed when={searchStore.opened() + 1}>
      <SearchSurface
        initial={searchStore.saved()}
        onChange={searchStore.save}
        onEscape={() => sidebarStore.setNavView("home")}
      />
    </Show>
  );
}
