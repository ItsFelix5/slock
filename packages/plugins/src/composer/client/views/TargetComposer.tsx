import { draftCacheKey } from "@slock/plugins/drafts/client/api";
import { Show, untrack } from "solid-js";
import type { ComposerProps } from "../composerTypes";
import Composer from "./Composer";

export default function TargetComposer(props: ComposerProps) {
  return (
    <Show keyed when={draftCacheKey(props.channelId, props.threadTs)}>
      {(_target) => {
        const target = untrack(() => ({ channelId: props.channelId, threadTs: props.threadTs }));
        return <Composer {...props} channelId={target.channelId} threadTs={target.threadTs} />;
      }}
    </Show>
  );
}
