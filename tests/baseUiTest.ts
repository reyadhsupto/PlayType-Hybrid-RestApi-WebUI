// tests/baseUiTest.ts
import { test as base } from '@playwright/test';
import { POManager } from '../src/ui/poManager.js';
import { BasePage } from '../src/ui/pages/basePage.js';
import config from '../src/sharedUtils/config.js';

export const test = base.extend<{ poManager: POManager; basePage: BasePage }>({
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
});