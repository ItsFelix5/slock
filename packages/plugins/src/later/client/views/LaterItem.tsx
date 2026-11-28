import { service } from "@slock/core/solid";
import type { SavedItem } from "@slock/types";
import LaterItemCard from "./LaterItemCard";

const later = service("later");

export default function LaterItem(props: { item: SavedItem }) {
  const message = later.createLaterMessage(() => props.item);
  return (
    <LaterItemCard
      failed={message.state().status === "error"}
      item={props.item}
      message={message.state().data}
      onRetry={message.retry}
    />
  );
}
