// tests/electron/login.spec.ts
//
// SAMPLE spec for the bundled "Pathao Resto" demo app. It depends on the demo
// fixtures (pathaoApp / loginPage / restoApp declared in
// tests/baseElectronTest.ts). For a different packaged app, replace this spec
// with your own flows - the generic Electron harness does not need it.

import { test, expect } from "../baseElectronTest.js";

test.describe("Electron Resto Admin Login (sample app)", { tag: ["@ELECTRON"] }, () => {
  // Boot + login can take longer than the default 60s cap.
  test.setTimeout(180_000);

  test("logs in as admin and reaches the dashboard", { tag: ["@EL_001"] }, async ({
    pathaoApp,
  }) => {
    // Graceful cold start + admin login (fills the form from config when needed).
    await pathaoApp.ensureAdminLoggedIn();
    await pathaoApp.waitForDashboard();

    expect(await pathaoApp.isLoggedIn()).toBe(true);

    // Dashboard specific markers discovered live: orders page + merchant profile.
    const url = pathaoApp.page.url();
    expect(url).toContain("/orders");

    const bodyText = await pathaoApp.getBodyText();
    expect(bodyText).toContain("Orders");
    expect(bodyText.toLowerCase()).toContain("mithai");

    // Window title should now be the authenticated app shell title.
    const title = await pathaoApp.getWindowTitle();
    expect(title).toBeTruthy();

    // Capture the authenticated admin dashboard.
    await pathaoApp.takeScreenshot(`admin-logged-in-${Date.now()}`);

    // Navigation sanity: dashboard URL should not be a login route anymore.
    expect(url).not.toMatch(/login|signin|auth/i);
  });

  test("debug helpers are available on the electron page object", { tag: ["@ELECTRON", "@debug"] }, async ({
    pathaoApp,
  }) => {
    await pathaoApp.waitUntilReady();

    // sleep() / sleepForSeconds() explicit-wait helpers.
    await pathaoApp.sleep(100);
    await pathaoApp.sleepForSeconds(1);

    // debugDump() logs url/title/body for troubleshooting.
    await pathaoApp.debugDump("debug-helpers-check", false);

    expect(await pathaoApp.isBodyVisible()).toBe(true);
  });
});