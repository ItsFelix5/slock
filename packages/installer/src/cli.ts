import { createInterface } from "node:readline/promises";
import { runCommand } from "./commands";
import { parseCommand } from "./spec";

try {
  await runCommand(parseCommand(Bun.argv.slice(2)), {
    ask: async (question) => {
      const lines = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await lines.question(`${question} `);
      } finally {
        lines.close();
      }
    },
    interactive: process.stdin.isTTY === true,
    print: console.log,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
