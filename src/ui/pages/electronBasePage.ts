// src/ui/pages/electronBasePage.ts

import { Page, ElectronApplication, test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { BasePage } from "./basePage.js";
import { HelperActions } from "../actions/helperActions.js";
import { logger } from "../../sharedUtils/logger.js";
import {
  launchElectronApp,
  waitForReadyWindow,
  closeElectronApp,
  type WaitForReadyOptions,
} from "../electron/electronLauncher.js";
import type { ElectronLaunchResult } from "../electron/electronLauncher.js";

/**
 * Base page for testing packaged Electron (desktop) applications.
 *
 * Electron windows are Playwright `Page` objects, so every action inherited from
 * {@link BasePage} (click, fill, waitFor, select, screenshot, drag, etc.) works
 * unchanged. This class adds Electron-specific setup, graceful cold-start
 * waiting, and main-process helpers.
 *
 * Example:
 * ```ts
 * const page = new ElectronBasePage(null as any);
 * await page.setup();
 * await page.waitUntilReady();
 * await page.takeScreenshot("app-launch");
 * ```
 */
export class ElectronBasePage extends BasePage {
  /** Playwright handle to the running Electron application. */
  app!: ElectronApplication;

  /** Absolute path to the launched `.app` bundle (populated after setup). */
  appPath!: string;

  constructor(page: Page) {
    super(page);
  }

  /**
   * Launch the packaged Electron app (extracting it from the DMG on first run)
   * and store the main window as the page object.
   *
   * Unlike {@link BasePage.setup} this does not create a browser/context
   * manually - Playwright attaches to the Electron application directly.
   *
   * @param _url - Ignored for Electron (the app owns its own URL/entry)
   * @param _setupauth - Reserved for auth injection; not applied for Electron
   * @returns The ready main window Page
   */
  override async setup(_url?: string, _setupauth?: boolean): Promise<Page> {
    const result: ElectronLaunchResult = await launchElectronApp();
    this.app = result.app;
    this.appPath = result.appPath;
    this.page = result.page;
    this.helperActions = new HelperActions(this.page, this.app.context());
    return this.page;
  }

  /**
   * Gracefully wait until the app's main window becomes usable.
   *
   * Handles cold launches (first run from a freshly extracted bundle) by polling
   * for a stable window instead of relying on a fixed sleep.
   *
   * @param opts - Optional readiness predicate / timeout overrides
   * @returns The ready main window
   */
  async waitUntilReady(opts: WaitForReadyOptions = {}): Promise<Page> {
    if (!this.app) {
      throw new Error("Electron app not launched. Call setup() first.");
    }
    this.page = await waitForReadyWindow(this.app, opts);
    return this.page;
  }

  /**
   * Run code in the Electron main process.
   *
   * @typeParam R - Return type produced in the main process
   * @param handler - Function executed against Electron's main modules (app, BrowserWindow, ...)
   * @returns The value returned by the handler
   */
  async mainProcess<R>(handler: (electron: any) => R | Promise<R>): Promise<R> {
    return this.app.evaluate(handler as never);
  }

  /**
   * Explicit fixed wait (milliseconds).
   *
   * Prefer smart waits (`waitForElementVisible`, `waitUntilReady`) in assertions;
   * `sleep` is provided for cases where a hard pause is genuinely required.
   *
   * @param ms - Number of milliseconds to wait
   */
  async sleep(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Explicit fixed wait (seconds) - convenience alias for {@link BasePage.waitForSeconds}.
   *
   * @param seconds - Number of seconds to wait
   */
  async sleepForSeconds(seconds: number): Promise<void> {
    await this.page.waitForTimeout(seconds * 1000);
  }

  /**
   * Pause execution and open the Playwright inspector for manual step-through.
   *
   * Note: in `--headed` runs this blocks the test until you resume in the
   * inspector; do not use it in CI.
   */
  async pause(): Promise<void> {
    logger.info("[Electron] Playwright inspector paused. Resume manually in the inspector.");
    await this.page.pause();
  }

  /**
   * Dump the current app state to the log for debugging/selector discovery.
   *
   * Logs the current URL, window title, and a trimmed view of the visible body
   * text. Optionally captures a screenshot named `<label>.png`.
   *
   * @param label - Label used in the log line and screenshot file name
   * @param takeShot - When true, also saves a screenshot
   */
  async debugDump(label = "electron-debug", takeShot = false): Promise<void> {
    try {
      const url = this.page.url();
      const title = await this.page.title();
      const bodyText = (await this.page.locator("body").innerText({ timeout: 2000 }).catch(() => ""))
        .replace(/\s+/g, " ")
        .trim();

      logger.info(`[Debug] ${label} | url=${url}`);
      logger.info(`[Debug] ${label} | title=${title}`);
      logger.info(`[Debug] ${label} | body=${bodyText.slice(0, 1500)}`);
    } catch (error) {
      logger.warn(`[Debug] ${label} | dump failed: ${String(error)}`);
    }

    if (takeShot) {
      await this.takeScreenshot(label).catch(() => undefined);
    }
  }

  /**
   * Number of currently open Electron windows.
   *
   * @returns Count of open windows
   */
  async windowCount(): Promise<number> {
    return this.app.windows().length;
  }

  /**
   * Capture the visible contents of the first BrowserWindow from the main
   * process using `webContents.capturePage()`. Useful when the standard page
   * screenshot (renderer only) is not enough - e.g. native overlays.
   *
   * @returns PNG image bytes
   */
  async captureView(): Promise<Buffer> {
    const raw = await this.app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) {
        throw new Error("No BrowserWindow available to capture");
      }
      const image = await win.webContents.capturePage();
      return image.toPNG();
    });
    return Buffer.from(raw);
  }

  /**
   * Take a renderer-level screenshot of the main window, save to `screenshots/`
   * and attach to the HTML/Allure report.
   *
   * Ensures the file name carries a valid image extension and the destination
   * directory exists so the capture never fails on a missing extension or dir.
   *
   * @param name - Optional file name (extension is appended when missing); defaults to
   *               a timestamped `<app>-<ts>.png`
   */
  override async takeScreenshot(name: string = `app-${Date.now()}.png`): Promise<void> {
    const normalized = name.trim();
    const filename = /\.(png|jpe?g|webp)$/i.test(normalized) ? normalized : `${normalized}.png`;

    const screenshotsDir = path.resolve(process.cwd(), "screenshots");
    fs.mkdirSync(screenshotsDir, { recursive: true });

    const rawPng = await this.page.screenshot({ fullPage: true });
    const filePath = path.join(screenshotsDir, filename);
    fs.writeFileSync(filePath, rawPng);

    await test.info().attach(filename, {
      body: rawPng,
      contentType: "image/png",
    });
    logger.info(`Electron screenshot saved: ${filePath}`);
  }

  /**
   * Take a screenshot and attach it; safe to call from catch blocks.
   *
   * @param testName - Test name used to build the failure file name
   */
  override async screenshotOnFailure(testName: string): Promise<void> {
    try {
      const name = `failure-${testName.replace(/\s+/g, "-")}-${Date.now()}.png`;
      await this.takeScreenshot(name);
    } catch (error) {
      logger.error(`Failed to take Electron screenshot: ${String(error)}`);
    }
  }

  /**
   * Close the Electron application.
   */
  override async teardown(): Promise<void> {
    await closeElectronApp(this.app);
  }

  /** Promise helper for attaching buffers to the report (kept private util). */
  protected async attachBuffer(name: string, buffer: Buffer, contentType = "image/png"): Promise<void> {
    await test.info().attach(name, { body: buffer, contentType });
  }
}