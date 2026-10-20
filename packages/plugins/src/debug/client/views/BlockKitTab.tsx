import { BlockKit, createViewState, validateView } from "@slock/blockkit";
import { Button, showDebugInfo } from "@slock/ui";
import { createSignal } from "solid-js";
import { galleryBlocks } from "./blockKitGallery";

export default function BlockKitTab() {
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const state = createViewState((blockId) =>
    setErrors((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== blockId))),
  );
  const context = { view: { blocks: () => galleryBlocks, errors, id: "gallery", state } };

  return (
    <>
      <h2>Block Kit</h2>
      <div class="settings-section">
        <BlockKit blocks={galleryBlocks} context={context} />
        <div class="flex-align-center">
          <Button
            onClick={() => setErrors(validateView(galleryBlocks, state.snapshot(galleryBlocks)))}
          >
            Validate
          </Button>
          <Button onClick={() => showDebugInfo("View state", state.snapshot(galleryBlocks))}>
            Show state
          </Button>
        </div>
      </div>
    </>
  );
}
