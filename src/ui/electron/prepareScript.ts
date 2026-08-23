// src/ui/electron/prepareScript.ts

import { prepareElectronApp } from "./electronPackageResolver.js";
import { logger } from "../../sharedUtils/logger.js";

/**
 * CLI script for preparing/caching the packaged Electron app without launching it.
 * Useful as a one-time setup step and for CI.
 *
 * Usage:
 *   npx tsx src/ui/electron/prepareScript.ts
 */
async function main(): Promise<void> {
  logger.info("[Prepare] Starting Electron app preparation...");
  const { appPath, binaryPath } = await prepareElectronApp();
  logger.info(`[Prepare] Bundle ready: ${appPath}`);
  logger.info(`[Prepare] Binary: ${binaryPath}`);
  logger.info("[Prepare] Done. The app can now be launched by Electron tests.");
}

main().catch((error) => {
  logger.error(`[Prepare] Failed: ${String(error)}`);
  process.exit(1);
});
