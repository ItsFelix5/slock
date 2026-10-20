import { formatSlackDate, formatSlackDateTokens } from "@slock/blockkit";
import type { ComposerSuggest, ExtraSuggestion } from "../../../composer/client/api";
import { parseDateQuery } from "./parseDateQuery";

const DATE_FORMATS = [
  { description: "Natural", format: "{date}", relative: "{date_pretty}" },
  { description: "Abbreviated", format: "{date_short}", relative: "{date_short_pretty}" },
  { description: "With weekday", format: "{date_long}", relative: "{date_long_pretty}" },
];

const TIME_FORMATS = [
  { description: "Time", format: "{time}" },
  { description: "Time with seconds", format: "{time_secs}" },
];

export const dateSuggest: ComposerSuggest = {
  search(query) {
    const parsed = parseDateQuery(query);
    if (!parsed) return [];
    const fallback = formatSlackDate(parsed.ts);
    const suffix = parsed.hasTime ? " at {time}" : "";
    const suggestion = (description: string, format: string) => ({
      description,
      id: `${query}${format}`,
      insert: `<!date^${parsed.ts}^${format}|${fallback}>`,
      label: formatSlackDateTokens(format, parsed.ts),
    });
    const suggestions: ExtraSuggestion[] = [
      ...DATE_FORMATS.map(({ description, format, relative }) => ({
        ...suggestion(`${description}, relative`, `${relative}${suffix}`),
        alternate: suggestion(description, `${format}${suffix}`),
      })),
      ...(parsed.hasTime ? TIME_FORMATS : []).map((entry) =>
        suggestion(entry.description, entry.format),
      ),
      suggestion("Relative time", "{ago}"),
    ];
    return suggestions;
  },
  trigger: "!",
};
