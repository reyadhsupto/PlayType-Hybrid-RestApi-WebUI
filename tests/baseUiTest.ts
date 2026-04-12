// tests/baseUiTest.ts

import { test as base } from '@playwright/test';
import { POManager } from '../src/ui/poManager.js';
import { BasePage } from '../src/ui/pages/basePage.js';
import { CreateQuestPage } from '../src/ui/pages/createQuestPage.js';
import { UpdateQuestPage } from '../src/ui/pages/updateQuestPage.js';
import config from '../src/sharedUtils/config.js';

/**
 * Extended test fixtures for UI testing
 * 
 * Provides:
 * - basePage: Base page setup/teardown with browser management
 * - poManager: Page Object Manager for accessing all page objects
 * - createQuestPage: Direct access to CreateQuestPage (alternative to poManager.getCreateQuestPage())
 * - updateQuestPage: Direct access to UpdateQuestPage (alternative to poManager.getUpdateQuestPage())
 * 
 * Usage Options:
 * 
 * Option 1: Using POManager (recommended for larger projects with many pages)
 *   test('example', async ({ poManager }) => {
 *     await poManager.getCreateQuestPage().clickCreateButton();
 *   });
 * 
 * Option 2: Direct Page Objects (recommended for cleaner code with fewer pages)
 *   test('example', async ({ createQuestPage }) => {
 *     await createQuestPage.clickCreateButton();
 *   });
 */
export const test = base.extend<{
  basePage: BasePage;
  poManager: POManager;
  createQuestPage: CreateQuestPage;
  updateQuestPage: UpdateQuestPage;
}>({
  basePage: async ({}, use) => {
    // Create a BasePage without a page (will be created in setup)
    const basePage = new BasePage(null as any); // Temporary
    
    // Setup creates browser/context/page
    await basePage.setup(config.dashboard_url);
    
    await use(basePage);
    
    // Cleanup
    await basePage.teardown();
  },
  
  poManager: async ({ basePage }, use) => {
    // POManager uses the page from basePage.setup()
    const poManager = new POManager(basePage.page);
    await use(poManager);
  },

  /**
   * createQuestPage Fixture
   * Provides direct access to CreateQuestPage without using POManager
   * Useful for tests focused on a single page
   */
  createQuestPage: async ({ basePage }, use) => {
    const createQuestPage = new CreateQuestPage(basePage.page);
    await use(createQuestPage);
  },

  /**
   * updateQuestPage Fixture
   * Provides direct access to UpdateQuestPage without using POManager
   * Useful for tests focused on a single page
   */
  updateQuestPage: async ({ basePage }, use) => {
    const updateQuestPage = new UpdateQuestPage(basePage.page);
    await use(updateQuestPage);
  },
});