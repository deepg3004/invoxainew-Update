import fs from "node:fs";
import path from "node:path";
import { config as dotenvConfig } from "dotenv";

let loaded = false;

/**
 * Walk up from a starting directory until we find the monorepo root
 * (identified by pnpm-workspace.yaml). Returns null if not found.
 */
function findMonorepoRoot(start: string): string | null {
  let dir = start;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Load the single root `.env` into process.env exactly once.
 *
 * We keep ONE .env at the monorepo root so there is a single source of truth
 * for secrets. dotenv never overrides variables already present in the
 * environment, so values injected by the host/CI win over the file.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const root = findMonorepoRoot(process.cwd());
  if (root) {
    dotenvConfig({ path: path.join(root, ".env") });
  }
}
