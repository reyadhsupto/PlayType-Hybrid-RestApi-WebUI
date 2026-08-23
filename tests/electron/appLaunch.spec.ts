// tests/electron/appLaunch.spec.ts
//
// Generic smoke test for the app-agnostic Electron harness. It works against
// ANY packaged Electron app configured via ELECTRON_DMG_PATH /
// ELECTRON_BINARY_PATH because it only relies on the core `electronPage`
// fixture (no app-specific page objects are involved).

import { test, expect } from "../baseElectronTest.js";

test.describe("Electron App Launch", () => {
  test("launches the packaged app and captures a screenshot", { tag: ["@ELECTRON", "@smoke"] }, async ({
    electronPage,
  }) => {
    // Graceful cold-start: wait until the main window is stable/ready.
    const page = await electronPage.waitUntilReady();
    expect(page).toBeTruthy();

    // The renderer must have booted: the document URL is present and the body
    // element is visible.
    await electronPage.waitForElementVisible("body", 15000);
    expect(electronPage.page.url().length).toBeGreaterThan(0);

    // Read app metadata straight from the Electron main process.
    const info = await electronPage.mainProcess(({ app, BrowserWindow }) => ({
      name: app.getName(),
      version: app.getVersion(),
      openWindows: BrowserWindow.getAllWindows().length,
    }));
    expect(info.name.length).toBeGreaterThan(0);
    expect(info.version.length).toBeGreaterThan(0);
    expect(info.openWindows).toBeGreaterThan(0);

    // The Playwright app handle must report at least one open window.
    expect(await electronPage.windowCount()).toBeGreaterThan(0);

    // Save a screenshot (page-level) and attach it to the report.
    await electronPage.takeScreenshot(`app-launch-${Date.now()}`);

    // Capture the native window contents from the main process (optional).
    try {
      const png = await electronPage.captureView();
      expect(png.byteLength).toBeGreaterThan(0);
    } catch {
      // Non-fatal: main-process capture may be unsupported in some builds.
    }
  });
});