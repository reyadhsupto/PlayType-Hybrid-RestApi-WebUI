// src/ui/pages/electronPathaoAppPage.ts

import { ElectronBasePage } from "./electronBasePage.js";
import { ElectronLoginPage } from "./electronLoginPage.js";
import config from "../../sharedUtils/config.js";
import { logger } from "../../sharedUtils/logger.js";

/**
 * Page object for the packaged "Pathao Resto" Electron app main window.
 *
 * SAMPLE / DEMO page object for one concrete app. The framework's Electron core
 * is app-agnostic; this class shows how to model a real Electron app on top of
 * {@link ElectronBasePage} / {@link BasePage}, and it owns the admin login flow
 * used to reach the dashboard. For a different app, model your own page objects
 * the same way and replace (or remove) this one.
 */
export class ElectronPathaoAppPage extends ElectronBasePage {
  private readonly root = "body";
  private readonly appRoot = "#root";

  /** Login screen helper bound to the same window. */
  private readonly loginPage: ElectronLoginPage;

  constructor(page: import("@playwright/test").Page) {
    super(page);
    this.loginPage = new ElectronLoginPage(page);
  }

  /**
   * Assert the app DOM has booted (renderer ready).
   *
   * @returns True when the app root element exists
   */
  async isAppBooted(): Promise<boolean> {
    return this.elementExists(this.appRoot);
  }

  /**
   * Get the current window title.
   *
   * @returns The document title of the main window
   */
  async getWindowTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Verify the root body element is visible.
   *
   * @returns True when the body is rendered and visible
   */
  async isBodyVisible(): Promise<boolean> {
    await this.waitForElementVisible(this.root, 15000);
    return true;
  }

  /**
   * Read the current visible body text (normalized for easy matching).
   *
   * @returns Trimmed, whitespace-normalized body inner text
   */
  async getBodyText(): Promise<string> {
    return (await this.page.locator("body").innerText({ timeout: 3000 }).catch(() => ""))
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Detect whether the app is still in its bootstrap/loading phase.
   *
   * The SPA shows "Loading ...", "Loading Application", or
   * "Checking authentication and permissions..." until boot completes.
   *
   * @returns True while the boot loader is visible
   */
  async isLoading(): Promise<boolean> {
    const text = await this.getBodyText();
    return /loading|checking authentication|checking access permission|checking role|checking zone/i.test(
      text
    );
  }

  /**
   * Wait until the authenticated dashboard shell is fully rendered.
   *
   * The app transitions through "Checking access permissions..." after login;
   * this helper polls until the loader is gone and the Orders dashboard text
   * is present.
   *
   * @param timeoutMs - Max time to wait for the dashboard to render
   */
  async waitForDashboard(timeoutMs = 45000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const text = await this.getBodyText();
      const loginVisible = await this.loginPage.isLoginScreenVisible();
      if (!loginVisible && !(await this.isLoading()) && /orders/i.test(text)) {
        return;
      }
      await this.sleep(1200);
    }
    await this.debugDump("dashboard-not-ready", true);
    throw new Error(`Dashboard did not become ready within ${timeoutMs}ms.`);
  }

  /**
   * Wait for the app to finish booting and report whether a login is required.
   *
   * Polls until the login form is visible (returns `"login"`) or the loading
   * text disappears (returns `"dashboard"`).
   *
   * @param timeoutMs - Max time to wait for the boot phase to end
   * @returns `"login"` when the login screen appeared, otherwise `"dashboard"`
   */
  async waitForBootState(timeoutMs = 30000): Promise<"login" | "dashboard"> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.loginPage.isLoginScreenVisible()) {
        return "login";
      }
      if (!(await this.isLoading())) {
        return "dashboard";
      }
      await this.sleep(1000);
    }
    logger.warn("[Auth] App still booting after timeout; falling back to login-screen check.");
    return (await this.loginPage.isLoginScreenVisible()) ? "login" : "dashboard";
  }

  /**
   * Detect whether the user is logged in (dashboard/app shell present).
   *
   * We treat "logged in" as: the boot loader is gone, no login form is visible,
   * and the URL is no longer pointing at a login route.
   *
   * @returns True when the app is past the login screen
   */
  async isLoggedIn(): Promise<boolean> {
    const loginVisible = await this.loginPage.isLoginScreenVisible();
    const loading = await this.isLoading();
    const url = this.page.url();
    return !loginVisible && !loading && !/login|signin|sign-in|auth/i.test(url);
  }

  /**
   * Ensure the admin is logged in.
   *
   * Flow:
   * 1. Gracefully wait until the main window is ready (cold-start aware).
   * 2. Wait for the boot/authentication phase to finish.
   * 3. If the login screen is shown, fill credentials from
   *    `config.electron.auth` and submit.
   * 4. Poll for a logged-in state; dump the page state on failure.
   *
   * @param timeoutMs - Max time to wait for login to complete
   */
  async ensureAdminLoggedIn(timeoutMs = 60000): Promise<void> {
    await this.waitUntilReady();

    const bootState = await this.waitForBootState();
    if (bootState === "dashboard") {
      logger.info("[Auth] Dashboard detected after boot; admin is already logged in.");
      return;
    }

    const { email, password } = config.electron.auth;
    if (!email || !password) {
      throw new Error(
        "Electron admin credentials missing. Set ELECTRON_APP_EMAIL and ELECTRON_APP_PASSWORD."
      );
    }

    logger.info(`[Auth] Login screen detected. Logging in as ${email}`);
    await this.loginPage.login(email, password);

    // Wait until the login form disappears (dashboard/redirect finished).
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isLoggedIn()) {
        logger.info("[Auth] Admin login verified on the dashboard.");
        return;
      }
      const loginError = await this.loginPage.getLoginError();
      if (loginError) {
        await this.loginPage.dumpLoginState("login-failed");
        throw new Error(`Electron login failed: ${loginError}`);
      }
      await this.sleep(1500);
    }

    await this.loginPage.dumpLoginState("login-timeout");
    throw new Error(`Timed out waiting for admin login after ${timeoutMs}ms.`);
  }
}