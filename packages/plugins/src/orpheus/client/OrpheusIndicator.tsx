import { EmojiText } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { Tooltip } from "@slock/ui";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, Show } from "solid-js";
import type { ComposerTrailingProps } from "../../composer/client/api";
import { defineKey } from "../../query/client/api";
import { isHaiku } from "./haiku/isHaiku";
import "./OrpheusIndicator.css";

const HAIKU_OFF_CHANNEL = "C09MATKQM8C";
const MAX_LENGTH = 300;

const syllableExceptionsKey = defineKey<[]>("syllableExceptions");

const query = service("query");

export default function OrpheusIndicator(props: ComposerTrailingProps) {
  const counts = createQuery(
    () => ({
      queryFn: () => import("./haiku/syllableExceptions").then((m) => m.default),
      queryKey: syllableExceptionsKey(),
      staleTime: Number.POSITIVE_INFINITY,
    }),
    () => query.client,
  );
  const reacts = createMemo(() => {
    const text = props.text.replaceAll("&", "&amp;");
    return (
      !!counts.data &&
      props.channelId !== HAIKU_OFF_CHANNEL &&
      text.length < MAX_LENGTH &&
      isHaiku(text, counts.data)
    );
  });
  return (
    <Show when={reacts()}>
      <Tooltip class="orpheus-indicator" content="Orpheus will react to this haiku">
        <span tabindex="0">
          <EmojiText text=":woa:" />
        </span>
      </Tooltip>
    </Show>
  );
}
