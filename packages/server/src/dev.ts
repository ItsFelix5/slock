import { join } from "node:path";
import { devServerOptions } from "@slock/installer/dev";
import { startServer } from "./start.ts";

await startServer({
  ...(await devServerOptions()),
  dataDir: join(import.meta.dir, "../../../data"),
  dev: true,
});
