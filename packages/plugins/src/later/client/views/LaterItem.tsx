import { service } from "@slock/core/solid";
import type { SavedItem } from "@slock/types";
import { Errored, Loading, refresh } from "solid-js";
import LaterItemCard from "./LaterItemCard";

const later = service("later");

export default function LaterItem(props: { item: SavedItem }) {
  const message = later.createLaterMessage(() => props.item);
  return (
    <Errored
      fallback={(_error, reset) => (
        <LaterItemCard
          failed
          item={props.item}
          message={undefined}
          onRetry={() => {
            reset();
            void refresh(message);
          }}
        />
      )}
    >
      <Loading fallback={<LaterItemCard item={props.item} message={undefined} />}>
        <LaterItemCard item={props.item} message={message()} />
      </Loading>
    </Errored>
  );
}
