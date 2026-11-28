import { join } from "node:path";
import { startServer } from "@slock/core/serve";
import { devServerOptions } from "./dev";
import { REPO } from "./paths";

await startServer({
  ...(await devServerOptions()),
  dataDir: join(REPO, "data"),
  dev: true,
});
