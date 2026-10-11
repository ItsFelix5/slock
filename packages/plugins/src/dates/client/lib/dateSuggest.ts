import { formatSlackDate, formatSlackDateTokens } from "@slock/blockkit";
import type { ComposerSuggest } from "../../../composer/client/api";
import { parseDateQuery } from "./parseDateQuery";

const DATE_FORMATS = [
  { description: "Natural, relative", format: "{date_pretty}" },
  { description: "Abbreviated, relative", format: "{date_short_pretty}" },
  { description: "With weekday, relative", format: "{date_long_pretty}" },
  { description: "Natural", format: "{date}" },
  { description: "Abbreviated", format: "{date_short}" },
  { description: "With weekday", format: "{date_long}" },
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
    const formats = [
      ...DATE_FORMATS.flatMap((date) =>
        parsed.hasTime
          ? [{ description: date.description, format: `${date.format} at {time}` }]
          : [date],
      ),
      ...(parsed.hasTime ? TIME_FORMATS : []),
      { description: "Relative time", format: "{ago}" },
    ];
    return formats.map(({ description, format }) => ({
      description,
      id: `${query}${format}`,
      insert: `<!date^${parsed.ts}^${format}|${fallback}>`,
      label: formatSlackDateTokens(format, parsed.ts),
    }));
  },
  trigger: "!",
};
