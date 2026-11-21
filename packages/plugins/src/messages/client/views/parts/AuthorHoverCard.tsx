import { useBlockKitResolver } from "@slock/blockkit";
import type { UserId } from "@slock/types";
import type { JSX } from "@solidjs/web";

export default function AuthorHoverCard(props: { userId: UserId; children: JSX.Element }) {
  const resolver = useBlockKitResolver();
  return <>{resolver.wrapUserMention?.(props.userId, props.children) ?? props.children}</>;
}
