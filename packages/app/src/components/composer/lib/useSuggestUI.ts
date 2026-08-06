import { useClickOutside, useEscapeClose } from "@slock/ui";
import type { Accessor } from "solid-js";
import type { SuggestState } from "./suggestTypes";

export function useSuggestUI(
  suggestPopoverRef: Accessor<HTMLDivElement | undefined>,
  suggest: Accessor<SuggestState | null>,
  setSuggest: (value: SuggestState | null) => void,
) {
  useClickOutside(suggestPopoverRef, () => setSuggest(null));
  useEscapeClose(
    () => setSuggest(null),
    () => suggest() !== null,
  );
}
