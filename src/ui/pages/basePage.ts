// src/ui/pages/basePage.ts

import { HelperActions } from '../actions/helperActions.js';
import { Browser, Page, BrowserContext, chromium } from '@playwright/test';
import config from '../../sharedUtils/config.js';
import { setupAuth } from '../uiUtils/authUtils.js';

export class BasePage {
  page!: Page;
  context!: BrowserContext;
  browser!: Browser;

  constructor(page: Page) {
    this.page = page;
  }

  helperActions!: HelperActions;

  async setup(url: string = config.dashboard_url) {
    this.browser = await chromium.launch({
        headless: config.headless,
        slowMo: 0,
        args: ['--start-maximized']
    });
    this.context = await this.browser.newContext();

    //Mock gauth state as already Logged-in
    await setupAuth(this.context, url);

    this.page = await this.context.newPage();
    await this.page.goto(url);

    // Initialize helperActions
    this.helperActions = new HelperActions(this.page, this.context);

    return this.page;
  }

  /**
   * Closes the browser.
   */
  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Waits for certain seconds, like webdriverWait
   */
  async waitForSeconds(seconds: number){
    await this.page.waitForTimeout(seconds*1000);
  }

  /**
   * Waits for page load (network idle).
   */
  async waitForPageLoadIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Waits for page load (dom content loaded).
   */
  async waitForPageLoadDOM() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Asserts an element's DOM property.
   */
//   async assertElementProperty(locator: string, property: string, expected: any) {
//     const element = this.page.locator(locator);
//     const prop = await element.evaluate((el, prop) => el[prop], property);
//     if (prop !== expected) {
//       throw new Error(`Expected property '${property}' to be '${expected}', got '${prop}'`);
//     }
//   }

  /**
   * Waits for an element to be visible.
   */
  async waitForElementVisible(locator: string, timeout = 5000) {
    await this.page.locator(locator).waitFor({ state: 'visible', timeout });
  }

    /**
   * Waits for an element to be visible.
   */
  async waitForElementAttached(locator: string, timeout = 5000) {
    await this.page.locator(locator).waitFor({ state: 'attached', timeout });
  }

  /**
   * Checks if an element exists.
   */
  async elementExists(locator: string) {
    return await this.page.locator(locator).count() > 0;
  }

  /**
   * Gets text content of an element.
   */
  async getElementText(locator: string) {
    return await this.page.locator(locator).textContent();
  }

  /**
   * Pauses the test for debugging.
   */
  async pause() {
    await this.page.pause();
  }

  /**
   * Clicks an element specified by locator.
   * @param locator - The selector for the element to click.
   * @returns Promise<void>
   */
  async click(locator: string): Promise<void> {
    await this.page.locator(locator).click();
  }

  /**
   * Double-clicks an element specified by locator.
   * @param locator - The selector for the element to double-click.
   * @returns Promise<void>
   */
  async dblclick(locator: string): Promise<void> {
    await this.page.locator(locator).dblclick();
  }

  /**
   * Clears the field and types the provided text into the element.
   * @param locator - The selector for the input element.
   * @param text - The text to fill into the input.
   * @returns Promise<void>
   */
  async fill(locator: string, text: string): Promise<void> {
    await this.page.locator(locator).fill(text);
  }

  /**
   * Types the provided text character by character into the element.
   * @param locator - The selector for the input element.
   * @param text - The text to type into the input.
   * @returns Promise<void>
   */
  async type(locator: string, text: string): Promise<void> {
    await this.page.locator(locator).type(text);
  }

  /**
   * Presses a keyboard key on the element.
   * @param locator - The selector for the element.
   * @param key - The key to press (e.g., 'Enter', 'Tab').
   * @returns Promise<void>
   */
  async press(locator: string, key: string): Promise<void> {
    await this.page.locator(locator).press(key);
  }

  /**
   * Checks a checkbox element.
   * @param locator - The selector for the checkbox element.
   * @returns Promise<void>
   */
  async check(locator: string): Promise<void> {
    await this.page.locator(locator).check();
  }

  /**
   * Unchecks a checkbox element.
   * @param locator - The selector for the checkbox element.
   * @returns Promise<void>
   */
  async uncheck(locator: string): Promise<void> {
    await this.page.locator(locator).uncheck();
  }

  /**
   * Selects an option in a dropdown by value.
   * @param locator - The selector for the select element.
   * @param value - The value of the option to select.
   * @returns Promise<void>
   */
  async selectOptionByValue(locator: string, value: string): Promise<void> {
    await this.page.locator(locator).selectOption({ value });
  }

  /**
   * Hovers the mouse over the element.
   * @param locator - The selector for the element to hover over.
   * @returns Promise<void>
   */
  async hover(locator: string): Promise<void> {
    await this.page.locator(locator).hover();
  }

  /**
   * Drags an element to a target element.
   * @param sourceLocator - The selector for the element to drag.
   * @param targetLocator - The selector for the target element.
   * @returns Promise<void>
   */
  async dragTo(sourceLocator: string, targetLocator: string): Promise<void> {
    const source = this.page.locator(sourceLocator);
    const target = this.page.locator(targetLocator);
    await source.dragTo(target);
  }

  /**
   * Focuses the element specified by locator.
   * @param locator - The selector for the element to focus.
   * @returns Promise<void>
   */
  async focus(locator: string): Promise<void> {
    await this.page.locator(locator).focus();
  }

  /**
   * Scrolls the element into view if needed.
   * @param locator - The selector for the element to scroll into view.
   * @returns Promise<void>
   */
  async scrollIntoViewIfNeeded(locator: string): Promise<void> {
    await this.page.locator(locator).scrollIntoViewIfNeeded();
  }
}