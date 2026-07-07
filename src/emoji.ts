import { nameToEmoji } from 'gemoji';

// Every known shortcode alias (e.g. both "+1" and "thumbsup") mapped to its
// unicode glyph, sourced from GitHub's gemoji dataset — the same shortcode
// conventions Slack's own emoji picker originally borrowed from. ~1900 entries,
// vs. the ~140 this used to be hand-maintained as.
export const STANDARD_EMOJI: Record<string, string> = nameToEmoji;
