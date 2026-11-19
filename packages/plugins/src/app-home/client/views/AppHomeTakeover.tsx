import { BlockKit, createViewState } from "@slock/blockkit";
import { createEffect, Show } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";
import { dispatchHomeOpen } from "../fetch";
import "./AppHome.css";
import { useAppHome } from "./useAppHome";

export default function AppHomeTakeover(props: MessageHeaderProps) {
  const home = useAppHome(() => props.id);
  createEffect(
    () => home.data?.appHome?.app_id,
    (appId) => {
      if (appId) void dispatchHomeOpen(props.id, appId);
    },
  );
  return (
    <div class="app-home">
      <Show
        fallback={
          <p class="app-home-empty text-dim">{home.isPending ? "Loading" : "Nothing here yet"}</p>
        }
        keyed
        when={home.data?.view}
      >
        {(view) => (
          <BlockKit
            blocks={view.blocks}
            context={{
              appId: view.app_id,
              botId: view.bot_id,
              view: {
                blocks: () => view.blocks,
                errors: () => ({}),
                id: view.id,
                state: createViewState(),
              },
            }}
          />
        )}
      </Show>
    </div>
  );
}
