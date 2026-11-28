import { createImmediateSignal } from "@slock/ui";

export interface ThemeColorDefinition {
  derive?: string;
  key: string;
  label: string;
}

export type ThemeColors = Record<string, string>;

export function themeColorVar(key: string): string {
  return `--${key.replace(/([a-z])([A-Z]|\d+)/g, "$1-$2").toLowerCase()}`;
}

export function createThemeColorRegistry() {
  const [themeColorDefinitions, setDefinitions] = createImmediateSignal<ThemeColorDefinition[]>([]);
  return {
    add(definitions: ThemeColorDefinition[]): () => void {
      setDefinitions([...themeColorDefinitions(), ...definitions]);
      return () => {
        setDefinitions(themeColorDefinitions().filter((def) => !definitions.includes(def)));
      };
    },
    themeColorDefinitions,
  };
}
