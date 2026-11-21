import { parseArgs } from "node:util";

export type Spec = { kind: "id" | "path" | "url"; value: string; ref?: string; off: boolean };

const WHITESPACE = /\s+/;
const ID = /^[a-z0-9][a-z0-9-]*$/;
const URL_SPEC = /^https?:\/\//;

function classify(token: string, off: boolean): Spec {
  const [value = "", ref] = token.split("#");
  if (URL_SPEC.test(token)) return { kind: "url", off, ref, value };
  if (ID.test(token)) return { kind: "id", off, value };
  return { kind: "path", off, value: token };
}

export function parseTargets(targets: string[], off: boolean): Spec[] {
  return targets
    .flatMap((target) => target.split(","))
    .filter(Boolean)
    .map((target) => classify(target, off));
}

export function parseLine(line: string, inheritedOff: boolean): Spec[] {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: line.trim().split(WHITESPACE).filter(Boolean),
    options: { off: { type: "boolean" } },
  });
  return parseTargets(positionals, inheritedOff || values.off === true);
}

export type Command = {
  name: string;
  targets: string[];
  off: boolean;
  yes: boolean;
  force: boolean;
  dir?: string;
};

export function parseCommand(argv: string[]): Command {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      dir: { type: "string" },
      force: { type: "boolean" },
      off: { type: "boolean" },
      yes: { type: "boolean" },
    },
  });
  const [name = "", ...targets] = positionals;
  return {
    dir: values.dir,
    force: values.force === true,
    name,
    off: values.off === true,
    targets,
    yes: values.yes === true,
  };
}
