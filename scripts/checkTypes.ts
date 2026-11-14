const projects = [
  "packages/plugins/tsconfig.client.json",
  "packages/app/tsconfig.json",
  "tsconfig.test.json",
];

const results = await Promise.all(
  projects.map(async (project) => {
    const proc = Bun.spawn(["bunx", "tsc", "-p", project], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    return { code: await proc.exited, output };
  }),
);

for (const { output } of results) if (output) process.stdout.write(output);
process.exit(results.some(({ code }) => code !== 0) ? 1 : 0);
