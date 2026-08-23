// src/ui/electron/electronLauncher.ts

import { _electron, type ElectronApplication, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import config from "../../sharedUtils/config.js";
import { logger } from "../../sharedUtils/logger.js";
import { recurse } from "../../sharedUtils/recurse.js";
import { prepareElectronApp, type ResolvedApp } from "./electronPackageResolver.js";

/**
 * Result of a successful Electron launch.
 *
 * @property app - Playwright handle to the running Electron application
 * @property page - The first (main) window of the application as a Playwright Page
 * @property appPath - Absolute path to the packaged `.app` bundle
 * @property binaryPath - Absolute path to the launched app executable
 */
export interface ElectronLaunchResult {
  app: ElectronApplication;
  page: Page;
  appPath: string;
  binaryPath: string;
  userDataDir: string;
}

/**
 * Options controlling graceful (cold start) launch behaviour.
 *
 * @property predicate - Optional readiness check evaluated against the main
 *                       window before the launch is considered complete
 * @property timeoutMs - Max time to wait for the window to become ready
 * @property intervalMs - Poll interval while waiting for readiness
 */
export interface WaitForReadyOptions {
  predicate?: (page: Page) => Promise<boolean> | boolean;
  timeoutMs?: number;
  intervalMs?: number;
  freshSession?: boolean;
}

/**
 * Wait until the first Electron window is created and becomes usable.
 *
 * This is the graceful cold-start routine. Cold launches of a packaged Electron
 * app (especially the very first run from a freshly extracted bundle) can take a
 * while, and a window may only exist after the renderer has booted. We re-poll
 * with the framework `recurse` helper (rather than a fixed sleep) so slow first
 * launches are tolerated and logged instead of failing fast.
 *
 * @param app - Launched Electron application
 * @param options - Readiness predicate, timeout and interval overrides
 * @returns A Playwright Page representing the ready main window
 */
export async function waitForReadyWindow(
  app: ElectronApplication,
  options: WaitForReadyOptions = {}
): Promise<Page> {
  const timeoutMs = options.timeoutMs ?? config.electron.launchTimeout;
  const intervalMs = options.intervalMs ?? 2000;
  const message = "Electron main window ready";

  return recurse<Page>(
    async () => {
      // firstWindow() resolves once a window exists; wait for DOM below so the
      // renderer has actually booted before we hand the page back.
      const window = await app.firstWindow();
      await window.waitForLoadState("domcontentloaded").catch(() => undefined);
      return window;
    },
    async (page) => {
      if (options.predicate) {
        return options.predicate(page);
      }
      return page.url().length > 0;
    },
    {
      message,
      timeoutMs,
      intervalMs,
      log: (context) =>
        `[Electron] ${message} | attempt ${context.attempt} | elapsed ${context.elapsedMs}ms / ${context.timeoutMs}ms | ${
          context.error ? `error=${String(context.error)}` : `url=${context.value?.url?.() ?? "no window"}`
        }`,
    }
  );
}

/**
 * Resolve the packaged app bundle and launch it with Playwright Electron.
 *
 * @param options - Launch / readiness overrides applied on top of config values
 * @returns The ElectronLaunchResult containing app handle + first window
 */
export async function launchElectronApp(
  options: WaitForReadyOptions = {}
): Promise<ElectronLaunchResult> {
  const resolved: ResolvedApp = await prepareElectronApp();
  if (!resolved.binaryPath) {
    throw new Error(
      `Electron binary could not be resolved for ${resolved.packagePath} (${resolved.packageType}).`
    );
  }

  const freshSession = options.freshSession ?? true;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "playtype-electron-"));
  const launchArgs = [...config.electron.args];
  if (freshSession) {
    launchArgs.push(`--user-data-dir=${userDataDir}`);
  }

  logger.info(`[Electron] Launching app: ${resolved.binaryPath}`);
  logger.info(
    `[Electron] Args: ${launchArgs.length ? launchArgs.join(" ") : "(none)"}`
  );
  logger.info(`[Electron] Session dir: ${freshSession ? userDataDir : "(shared)"}`);

  const app = await _electron.launch({
    executablePath: resolved.binaryPath,
    args: launchArgs,
    timeout: config.electron.launchTimeout,
  });

  try {
    const page = await waitForReadyWindow(app, options);
    return {
      app,
      page,
      appPath: resolved.appPath,
      binaryPath: resolved.binaryPath,
      userDataDir,
    };
  } catch (error) {
    logger.error(`[Electron] App launch failed while waiting for window: ${String(error)}`);
    try {
      await app.close();
    } catch {
      /* ignore secondary close error */
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup failure */
    }
    throw error;
  }
}

/**
 * Gracefully close a running Electron application.
 *
 * @param app - The Electron application to close, if any
 */
export async function closeElectronApp(app: ElectronApplication | undefined): Promise<void> {
  if (!app) {
    return;
  }
  try {
    await app.close();
    logger.info("[Electron] App closed");
  } catch (error) {
    logger.warn(`[Electron] Failed to close app: ${String(error)}`);
  }
}

/**
 * Remove a temporary Electron user-data directory when one was created.
 *
 * @param userDataDir - Temp profile directory to delete
 */
export function cleanupElectronUserData(userDataDir: string | undefined): void {
  if (!userDataDir) {
    return;
  }

  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    logger.info(`[Electron] Cleaned user data dir: ${userDataDir}`);
  } catch (error) {
    logger.warn(`[Electron] Failed to clean user data dir ${userDataDir}: ${String(error)}`);
  }
}
