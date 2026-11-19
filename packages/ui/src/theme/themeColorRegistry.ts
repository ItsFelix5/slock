import { createImmediateSignal } from "../immediateSignal";

export interface ThemeColorDefinition {
  derive?: string;
  key: string;
  label: string;
}

export type ThemeColors = Record<string, string>;

const [themeColorDefinitions, setDefinitions] = createImmediateSignal<ThemeColorDefinition[]>([]);

export { themeColorDefinitions };

export function themeColorVar(key: string): string {
  return `--${key.replace(/([a-z])([A-Z]|\d+)/g, "$1-$2").toLowerCase()}`;
}

export function addThemeColorDefinitions(definitions: ThemeColorDefinition[]): () => void {
  setDefinitions([...themeColorDefinitions(), ...definitions]);
  return () => {
    setDefinitions(themeColorDefinitions().filter((def) => !definitions.includes(def)));
  };
}
