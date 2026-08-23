// src/ui/pages/electronLoginPage.ts

import { ElectronBasePage } from "./electronBasePage.js";
import { logger } from "../../sharedUtils/logger.js";
import { step } from "../pages/basePage.js";

/**
 * Login page object for the packaged "Pathao Resto" Electron app.
 *
 * SAMPLE / DEMO page object for one concrete app; it can be removed or replaced
 * when testing a different Electron app. The login screen renders client-side
 * (React SPA), so selectors use layered fallback strategies: placeholder
 * first, then accessibility role, then plain attribute selectors. Exact
 * selectors were pinned against the stage app.
 */
export class ElectronLoginPage extends ElectronBasePage {
  // Email input: prefers type=email, falls back to any visible textbox.
  private readonly emailInput =
    "input[type='email'], input[placeholder*='mail' i], input[name*='mail' i], input:not([type])";

  // Password input: standard companion of the email field.
  private readonly passwordInput = "input[type='password']";

  // Submit: button type=submit first, then any primary "Login"/"Sign in" button.
  private readonly submitButton =
    "button[type='submit'], button:has-text('Login'), button:has-text('Sign In'), button:has-text('Log in')";

  /**
   * Detect whether the login screen is currently shown.
   *
   * @returns True when a password field is present/visible on the current page
   */
  async isLoginScreenVisible(): Promise<boolean> {
    const passwordCount = await this.page.locator(this.passwordInput).count();
    return passwordCount > 0;
  }

  /**
   * Wait until the login form becomes available.
   *
   * @param timeoutMs - Max time to wait for the login screen
   */
  async waitForLoginScreen(timeoutMs = 30000): Promise<void> {
    await this.page.locator(this.passwordInput).first().waitFor({
      state: "attached",
      timeout: timeoutMs,
    });
  }

  /**
   * Fill the email and password fields.
   *
   * @param email - Admin/app user email
   * @param password - Account password
   */
  @step("Filling Electron login credentials for {{email}}")
  async fillCredentials(email: string, password: string): Promise<void> {
    const emailField = this.page.locator(this.emailInput).first();
    const passwordField = this.page.locator(this.passwordInput).first();

    await emailField.waitFor({ state: "attached", timeout: 15000 });
    await emailField.fill(email);
    await passwordField.fill(password);
  }

  /**
   * Click the login/submit button.
   *
   * @param timeoutMs - Max time to wait for a clickable submit control
   */
  @step("Clicking Electron login submit button")
  async clickLogin(timeoutMs = 15000): Promise<void> {
    const submit = this.page.locator(this.submitButton).first();
    await submit.waitFor({ state: "attached", timeout: timeoutMs });
    await submit.click();
  }

  /**
   * Perform the complete login flow (fill + submit).
   *
   * @param email - Admin or user email
   * @param password - Account password
   */
  @step("Logging into the Electron app as {{email}}")
  async login(email: string, password: string): Promise<void> {
    await this.waitForLoginScreen();
    await this.fillCredentials(email, password);
    await this.clickLogin();
    await this.waitForPageLoadIdle().catch(() => undefined);
  }

  /**
   * Detect whether the login attempt failed (error banner/message present).
   *
   * @returns The visible error message text, or empty string when no error shown
   */
  async getLoginError(): Promise<string> {
    const error = await this.page
      .locator("[class*='error' i], [class*='alert' i], [class*='toast' i]")
      .last()
      .innerText({ timeout: 2000 })
      .catch(() => "");
    return (error || "").trim();
  }

  /**
   * Log the current page state for debugging a failed login.
   *
   * @param label - Debug label used in logs
   */
  async dumpLoginState(label = "login-debug"): Promise<void> {
    logger.info(`[${label}] login screen visible=${await this.isLoginScreenVisible()}`);
    await this.debugDump(label, true);
  }
}