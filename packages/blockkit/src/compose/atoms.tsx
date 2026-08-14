import type { AtomRenderers } from "@slock/ui";
import EmojiText from "../emoji/EmojiText";
import { DateToken, Mention } from "../mrkdwn";
import {
  ATOM_DATE,
  ATOM_EMOJI,
  ATOM_MENTION,
  type DateAtomData,
  type EmojiAtomData,
  type MentionAtomData,
} from "./atomTypes";

/** Wired into EditorView's `atomRenderers` prop — these are the exact components MessageRow's
 * sent-message render uses, so a live mention/emoji/date chip looks identical while typing and
 * once sent, by construction rather than by hand-matched CSS. */
export const composeAtomRenderers: AtomRenderers = {
  [ATOM_DATE]: (props: { data: unknown }) => {
    const data = props.data as DateAtomData;
    return <DateToken fallback={data.fallback} format={data.format} timestamp={data.timestamp} />;
  },
  [ATOM_EMOJI]: (props: { data: unknown }) => {
    const data = props.data as EmojiAtomData;
    return <EmojiText text={`:${data.name}:`} />;
  },
  [ATOM_MENTION]: (props: { data: unknown }) => {
    const data = props.data as MentionAtomData;
    return <Mention id={data.refId} kind={data.target} />;
  },
};
