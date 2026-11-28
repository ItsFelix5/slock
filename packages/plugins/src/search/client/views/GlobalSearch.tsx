import { service } from "@slock/core/solid";
import { Icon, Modal } from "@slock/ui";
import { Show } from "solid-js";
import { DEFAULT_INPUTS } from "../searchQuery";
import SearchSurface from "./SearchSurface";

const searchStore = service("search");
const share = service("message-links.share");

export default function GlobalSearch(props: { onClose: () => void }) {
  const close = () => {
    share.clearPendingShare();
    props.onClose();
  };
  return (
    <Modal align="top" ariaLabel="Search Slack" class="search-modal" onClose={close}>
      <Show when={share.pendingShareText()}>
        {(text) => (
          <div class="search-share-banner flex-align-center">
            <Icon class="flex-shrink-0" name="share" size={13} />
            <span class="truncate">Pick where to send: {text()}</span>
          </div>
        )}
      </Show>
      <SearchSurface
        expand={(inputs) => {
          close();
          searchStore.show(inputs);
        }}
        initial={DEFAULT_INPUTS}
        jumpOnly={!!share.pendingShareText()}
        onOpened={props.onClose}
      />
    </Modal>
  );
}
