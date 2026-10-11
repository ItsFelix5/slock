export interface CalloutColor {
  name: string;
  value: number;
}

export const CALLOUT_COLORS: CalloutColor[] = [
  { name: "Grass", value: 0 },
  { name: "Jade", value: 1 },
  { name: "Lagoon", value: 2 },
  { name: "Indigo", value: 3 },
  { name: "Aubergine", value: 4 },
  { name: "Flamingo", value: 5 },
  { name: "Honeycomb", value: 6 },
  { name: "Horchata", value: 7 },
  { name: "Gray", value: 8 },
];

export const DEFAULT_CALLOUT_COLOR = 0;
