export type Violation = { rule: string; path: string; line: number; message: string };

export type SourceFile = {
  path: string;
  text: string;
  ext: string;
  area: string;
  isTest: boolean;
};

export type Rule = {
  group: string;
  ids: string[];
  check: (files: SourceFile[]) => Violation[];
};
