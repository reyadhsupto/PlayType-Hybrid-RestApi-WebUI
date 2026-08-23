// tests/baseElectronTest.ts

import { test as base, ElectronApplication } from "@playwright/test";
import { ElectronBasePage } from "../src/ui/pages/electronBasePage.js";
import { ElectronPOManager } from "../src/ui/electron/electronPoManager.js";
import { ElectronPathaoAppPage } from "../src/ui/pages/electronPathaoAppPage.js";
import { ElectronLoginPage } from "../src/ui/pages/electronLoginPage.js";
import config from "../src/sharedUtils/config.js";
import { logger } from "../src/sharedUtils/logger.js";
import {
  launchElectronApp,
  waitForReadyWindow,
  closeElectronApp,
  cleanupElectronUserData,
} from "../src/ui/electron/electronLauncher.js";

let activeElectronApp: ElectronApplication | undefined;
let activeElectronUserDataDir: string | undefined;
let shutdownHooksInstalled = false;

/**
 * Close the active Electron app and remove its temporary session directory.
 */
async function cleanupElectronRuntime(): Promise<void> {
  await closeElectronApp(activeElectronApp);
  cleanupElectronUserData(activeElectronUserDataDir);
  activeElectronApp = undefined;
  activeElectronUserDataDir = undefined;
}

/**
 * Install signal/error handlers once so Ctrl+C and abrupt exits do not leave
 * the packaged Electron process behind.
 */
function installElectronShutdownHooks(): void {
  if (shutdownHooksInstalled) {
    return;
  }

  shutdownHooksInstalled = true;

  const handleShutdown = async (signal: string) => {
    logger.warn(`[Electron] Received ${signal}; cleaning up app before exit.`);
    await cleanupElectronRuntime();
    process.exit(signal === "SIGINT" ? 130 : 143);
  };

  process.once("SIGINT", () => {
    void handleShutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void handleShutdown("SIGTERM");
  });

  process.once("uncaughtException", (error) => {
    logger.error(`[Electron] Uncaught exception: ${String(error)}`);
    void cleanupElectronRuntime().finally(() => process.exit(1));
  });

  process.once("unhandledRejection", (reason) => {
    logger.error(`[Electron] Unhandled rejection: ${String(reason)}`);
    void cleanupElectronRuntime().finally(() => process.exit(1));
  });
}

/**
 * Worker-scoped fixtures shared by all Electron tests in a single worker.
 *
 * @property electronApp - The launched Electron application, closed on worker teardown
 */
type ElectronWorkerFixtures = {
  electronApp: ElectronApplication;
};

/**
 * Test-scoped fixtures exposed to Electron specs.
 *
 * @property electronPage - An ElectronBasePage wrapping the app's main window
 * @property electronPoManager - Page Object Manager for Electron page objects
 * @property pathaoApp - Sample fixture: bundled "Pathao Resto" app page object (demo, removable)
 * @property loginPage - Sample fixture: bundled "Pathao Resto" login page object (demo, removable)
 * @property restoApp - Sample fixture: authenticated "Pathao Resto" page object (demo, removable)
 */
type ElectronTestFixtures = {
  appElectron: ElectronBasePage;
  appReady: ElectronBasePage;
  electronPage: ElectronBasePage;
  electronPoManager: ElectronPOManager;
  pathaoApp: ElectronPathaoAppPage;
  loginPage: ElectronLoginPage;
  restoApp: ElectronPathaoAppPage;
};

export const test = base.extend<ElectronTestFixtures, ElectronWorkerFixtures>({
  /**
   * Launch the packaged Electron app once per worker and reuse it across tests.
   *
   * The DMG is prepared (extracted + cached) on first launch. The app stays
   * running for the whole worker so progressively heavier flows remain fast.
   *
   * @fixture electronApp
   * @scope worker
   */
  electronApp: [
    async ({}, use) => {
      if (!config.electron.enabled) {
        throw new Error(
          "Electron testing is disabled. Set ELECTRON_ENABLED=true in your .env to run Electron specs."
        );
      }
      installElectronShutdownHooks();
      logger.info("[Electron] Launching app for worker (worker fixture)");
      const { app, userDataDir } = await launchElectronApp({ freshSession: true });
      activeElectronApp = app;
      activeElectronUserDataDir = userDataDir;
      await use(app);
      await cleanupElectronRuntime();
    },
    { scope: "worker" },
  ],

  /**
   * An ElectronBasePage wrapping the app's main window for the current test.
   *
   * Datasets are not isolated between tests automatically; the app is launched
   * once per worker and this fixture refreshes the main window reference so
   * each test starts from the current state.
   *
   * @fixture electronPage
   * @scope test
   */
  electronPage: async ({ electronApp }, use) => {
    const owner = new ElectronBasePage(null as any);
    owner.app = electronApp;
    owner.page = await waitForReadyWindow(electronApp);
    await use(owner);
  },

  /** Alias for electronPage retained for naming consistency. */
  appElectron: async ({ electronPage }, use) => {
    await use(electronPage);
  },

  /** Alias exposing a ready-ensured page (waitUntilReady still applied in specs). */
  appReady: async ({ electronPage }, use) => {
    await electronPage.waitUntilReady();
    await use(electronPage);
  },

  /**
   * Page Object Manager for Electron page objects.
   *
   * The manager is app-agnostic and registration based. Register any page
   * object that extends {@link ElectronBasePage} with
   * `electronPoManager.register("name", page)` and retrieve it with
   * `electronPoManager.get("name")`. Only generic fixtures are required; the
   * demo page objects below are samples.
   *
   * @fixture electronPoManager
   * @scope test
   */
  electronPoManager: async ({ electronPage }, use) => {
    await use(new ElectronPOManager(electronPage));
  },

  // ===== Sample fixtures: bundled "Pathao Resto" demo app =====
  // The fixtures below drive one specific packaged desktop app (the bundled
  // "Pathao Resto" demo) and exist so the sample specs can run out of the box.
  // They demonstrate how to expose your own Electron page objects from test
  // fixtures. For a different app, replace these fixtures with page objects for
  // that app, or remove them entirely - the core harness (electronApp /
  // electronPage / appElectron / appReady / electronPoManager) is fully
  // app-agnostic and does not depend on them.

  /**
   * Direct access to the bundled "Pathao Resto" demo app page object.
   *
   * @fixture pathaoApp
   * @scope test
   */
  pathaoApp: async ({ electronPage }, use) => {
    const pageObject = new ElectronPathaoAppPage(electronPage.page);
    pageObject.app = electronPage.app;
    await use(pageObject);
  },

  /**
   * Direct access to the sample app's login screen page object.
   *
   * @fixture loginPage
   * @scope test
   */
  loginPage: async ({ electronPage }, use) => {
    const pageObject = new ElectronLoginPage(electronPage.page);
    pageObject.app = electronPage.app;
    await use(pageObject);
  },

  /**
   * An authenticated sample "Pathao Resto" app page object.
   *
   * Ensures the admin is logged in (performs the login flow when the login
   * screen appears) before the test body runs.
   *
   * @fixture restoApp
   * @scope test
   */
  restoApp: async ({ pathaoApp }, use) => {
    await pathaoApp.ensureAdminLoggedIn();
    await use(pathaoApp);
  },
});

export { expect } from "@playwright/test";
