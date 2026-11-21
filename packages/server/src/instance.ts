import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "@slock/core";

export type UnitInfo = Manifest & {
  client: boolean;
  server: boolean;
  off: boolean;
  source: string;
};

export type InstanceService = {
  dev: boolean;
  clientDir: string | undefined;
  units: UnitInfo[];
  dataDir(id: string): string;
};

export function createInstance(options: {
  dev: boolean;
  clientDir?: string;
  dataDir: string;
  units: UnitInfo[];
}): InstanceService {
  return {
    clientDir: options.clientDir,
    dataDir: (id) => {
      const dir = join(options.dataDir, id);
      mkdirSync(dir, { recursive: true });
      return dir;
    },
    dev: options.dev,
    units: options.units,
  };
}
