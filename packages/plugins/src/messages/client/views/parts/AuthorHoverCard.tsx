import { useBlockKitResolver } from "@slock/blockkit";
import type { JSX } from "solid-js";

export default function AuthorHoverCard(props: { userId: string; children: JSX.Element }) {
  const resolver = useBlockKitResolver();
  return <>{resolver.wrapUserMention?.(props.userId, props.children) ?? props.children}</>;
}
