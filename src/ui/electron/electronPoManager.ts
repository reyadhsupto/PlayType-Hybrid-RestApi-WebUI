// src/ui/electron/electronPoManager.ts

import type { ElectronBasePage } from "../pages/electronBasePage.js";

/**
 * App-agnostic, registration based manager for Electron (packaged desktop app)
 * page objects.
 *
 * Any page object that extends {@link ElectronBasePage} can be registered under
 * a logical name and later retrieved by that name. Each registered page
 * automatically receives the owner's Electron application handle (`app`) and
 * bundle path (`appPath`) so main-process helpers (`mainProcess`,
 * `captureView`, `windowCount`) work without extra wiring.
 *
 * Example:
 * ```ts
 * const manager = new ElectronPOManager(owner);
 * manager.register("app", new MyElectronAppPage(owner.page));
 *
 * const page = manager.get<MyElectronAppPage>("app");
 * await page.waitUntilReady();
 * ```
 */
export class ElectronPOManager {
  private readonly registry = new Map<string, ElectronBasePage>();

  /**
   * @param owner - A configured ElectronBasePage holding the launched app + window
   */
  constructor(private readonly owner: ElectronBasePage) {}

  /**
   * Register a page object under a logical name.
   *
   * The page receives the owner's `app` and `appPath` automatically so the
   * main-process helpers are available immediately. Re-registering the same
   * name replaces the previous entry.
   *
   * @typeParam T - Concrete page object type
   * @param name - Logical name used for retrieval
   * @param page - Page object instance to register
   * @returns The registered page (same instance) for chaining
   */
  register<T extends ElectronBasePage>(name: string, page: T): T {
    page.app = this.owner.app;
    page.appPath = this.owner.appPath;
    this.registry.set(name, page);
    return page;
  }

  /**
   * Get a registered page object by name.
   *
   * @typeParam T - Concrete page object type i.e. the actual class of the page
   * @param name - Name the page was registered under
   * @returns The registered page object
   * @throws When no page object is registered under the given name
   */
  get<T extends ElectronBasePage>(name: string): T {
    const page = this.registry.get(name);
    if (!page) {
      throw new Error(`No Electron page object registered under "${name}".`);
    }
    return page as T;
  }

  /**
   * Check whether a page object name is registered.
   *
   * @param name - Name to look up
   * @returns True when a page object is registered under the name
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }
}