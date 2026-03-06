# UI Testing Guide

Complete guide to UI testing in the PlayType framework using Page Object Model.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Page Objects](#page-objects)
- [Authentication](#authentication)
- [Network Interception](#network-interception)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

The framework uses **Page Object Model (POM)** with Playwright fixtures for maintainable UI tests:

- **Page Object Model** - Reusable page classes
- **Fixture-based setup** - Automatic browser lifecycle
- **Auth state management** - Pre-configured authentication
- **Network utilities** - Intercept, mock, modify requests
- **Screenshot capture** - Automatic on failures
- **Helper actions** - Common UI patterns

---

## Architecture
```
Test File
    ↓
UI Fixtures (basePage, poManager)
    ↓
Page Object Manager
    ↓
Page Objects (CreateQuestPage, UpdateQuestPage)
    ↓
Base Page (common actions: click, fill, waitFor, etc.)
    ↓
Helper Actions (network interception, file upload, etc.)
    ↓
Playwright Page Object
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **BasePage** | Common page actions | `src/ui/pages/basePage.ts` |
| **Page Objects** | Page-specific methods | `src/ui/pages/*Page.ts` |
| **POManager** | Page object factory | `src/ui/poManager.ts` |
| **HelperActions** | Network & file utilities | `src/ui/actions/helperActions.ts` |
| **AuthUtils** | Authentication setup | `src/ui/uiUtils/authUtils.ts` |
| **baseUiTest** | UI test fixtures | `tests/baseUiTest.ts` |

---

## Getting Started

### Basic Test Structure
```typescript
import { test, expect } from '../baseUiTest.js';

test.describe("Create Quest", () => {
  
  test("Create new quest", async ({ poManager }) => {
    const createQuestPage = poManager.getCreateQuestPage();
    
    await createQuestPage.clickCreateButton();
    await createQuestPage.fillQuestForm({
      name: "Test Quest",
      description: "Test Description"
    });
    await createQuestPage.submitQuest();
    
    const message = await createQuestPage.getSuccessMessage();
    expect(message).toContain("success");
  });
});
```

### Import Structure
```typescript
// Fixtures
import { test, expect } from '../baseUiTest.js';

// No need to import page objects - use poManager fixture
```

---

## Page Objects

### Creating a Page Object
```typescript
// src/ui/pages/myPage.ts

import { Page } from '@playwright/test';
import { BasePage } from './basePage.js';

export class MyPage extends BasePage {
  // Locators (optional - can also use strings directly)
  private readonly submitButton = 'button[type="submit"]';
  private readonly titleInput = 'input[name="title"]';

  constructor(page: Page) {
    super(page);
    this.page = page;
  }

  // Page-specific actions
  async fillTitle(title: string): Promise<void> {
    await this.fill(this.titleInput, title);
  }

  async submit(): Promise<void> {
    await this.click(this.submitButton);
  }

  async getTitleText(): Promise<string | null> {
    return await this.getElementText(this.titleInput);
  }
}
```

### Base Page Actions

BasePage provides common actions:

#### Navigation & Waiting
```typescript
await basePage.waitForSeconds(2);                    // Wait 2 seconds
await basePage.waitForPageLoadIdle();                // Wait for network idle
await basePage.waitForPageLoadDOM();                 // Wait for DOM load
await basePage.waitForElementVisible('.selector');   // Wait for element
await basePage.waitForElementAttached('.selector');  // Wait for attached
```

#### Element Interaction
```typescript
await basePage.click('.button');                     // Click
await basePage.dblclick('.button');                  // Double-click
await basePage.fill('input', 'text');                // Clear and fill
await basePage.type('input', 'text');                // Type character by character
await basePage.press('input', 'Enter');              // Press key
await basePage.hover('.element');                    // Hover
await basePage.focus('input');                       // Focus element
```

#### Form Actions
```typescript
await basePage.check('input[type="checkbox"]');      // Check checkbox
await basePage.uncheck('input[type="checkbox"]');    // Uncheck checkbox
await basePage.selectOptionByValue('select', 'value'); // Select dropdown
```

#### Drag & Drop
```typescript
await basePage.dragTo('.source', '.target');         // Drag source to target
```

#### Utility Actions
```typescript
await basePage.scrollIntoViewIfNeeded('.element');   // Scroll into view
await basePage.pause();                              // Pause for debugging
const exists = await basePage.elementExists('.elem'); // Check existence
const text = await basePage.getElementText('.elem'); // Get text content
```

### Example Page Object: CreateQuestPage
```typescript
// src/ui/pages/createQuestPage.ts

import { Page } from '@playwright/test';
import { BasePage } from './basePage.js';

export class CreateQuestPage extends BasePage {
  private readonly createButton = '.fa.fa-plus';
  private readonly nameInput = 'input[name="questName"]';
  private readonly descriptionInput = 'textarea[name="questDescription"]';
  private readonly submitButton = 'button[type="submit"]';
  private readonly successMessage = '.success-message';

  constructor(page: Page) {
    super(page);
    this.page = page;
  }

  async clickCreateButton(): Promise<void> {
    await this.click(this.createButton);
    await this.waitForPageLoadIdle();
  }

  async fillQuestForm({ name, description }: { 
    name: string; 
    description: string 
  }): Promise<void> {
    await this.fill(this.nameInput, name);
    await this.fill(this.descriptionInput, description);
  }

  async submitQuest(): Promise<void> {
    await this.click(this.submitButton);
    await this.waitForElementVisible(this.successMessage);
  }

  async getSuccessMessage(): Promise<string | null> {
    return await this.getElementText(this.successMessage);
  }

  async isSubmitButtonEnabled(): Promise<boolean> {
    return await this.page.locator(this.submitButton).isEnabled();
  }
}
```

### Page Object Manager
```typescript
// src/ui/poManager.ts

import { Page } from '@playwright/test';
import { CreateQuestPage } from './pages/createQuestPage.js';
import { UpdateQuestPage } from './pages/updateQuestPage.js';

export class POManager {
  private createQuestPage: CreateQuestPage;
  private updateQuestPage: UpdateQuestPage;

  constructor(page: Page) {
    this.createQuestPage = new CreateQuestPage(page);
    this.updateQuestPage = new UpdateQuestPage(page);
  }

  getCreateQuestPage(): CreateQuestPage {
    return this.createQuestPage;
  }

  getUpdateQuestPage(): UpdateQuestPage {
    return this.updateQuestPage;
  }
}
```

---

## Authentication

### How It Works

The framework uses **localStorage + cookies** to pre-authenticate users, avoiding login for every test.

### Configuration
```env
# .env.stage
AUTH_KEY=authState
AUTH_TOKEN=your-jwt-token
AUTH_USER_EMAIL=test@example.com
AUTH_USER_NAME=Test User
```

### Setup Function
```typescript
// src/ui/uiUtils/authUtils.ts

export async function setupAuth(context: BrowserContext, url: string) {
  // Set localStorage
  await context.addInitScript((data) => {
    for (const key in data) {
      window.localStorage.setItem(key, JSON.stringify(data[key]));
    }
  }, localStorageObj);

  // Set cookies
  await context.addCookies([{
    name: "access_token",
    value: authToken,
    domain: ".example.com",
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: "Lax"
  }]);
}
```

### Usage in Tests

Auth is automatically set up via fixtures - no manual setup needed:
```typescript
test("Authenticated action", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage();
  // Already authenticated!
  await page.clickCreateButton();
});
```

### Custom Auth Per Test
```typescript
test.describe("Different User", () => {
  test.use({
    basePage: async ({}, use) => {
      const basePage = new BasePage(null as any);
      
      // Custom auth config
      const customConfig = {
        ...config,
        auth: {
          token: "different-token",
          user: { email: "different@example.com" }
        }
      };
      
      await basePage.setup(customConfig.dashboard_url);
      await use(basePage);
      await basePage.teardown();
    }
  });

  test("test with different user", async ({ poManager }) => {
    // Uses different auth
  });
});
```

---

## Network Interception

### Helper Actions
```typescript
// Access helper actions from page
const page = poManager.getCreateQuestPage().page;
const context = poManager.getCreateQuestPage().context;
const helpers = new HelperActions(page, context);
```

### Intercept and Mock
```typescript
test("Mock API response", async ({ poManager }) => {
  const helpers = new HelperActions(
    poManager.getCreateQuestPage().page,
    poManager.getCreateQuestPage().context
  );

  // Intercept and mock
  await helpers.interceptRequests('**/api/quests', async (route) => {
    await helpers.fulfillRoute(route, {
      success: true,
      quests: [{ id: 1, name: "Mocked Quest" }]
    });
  });

  // Continue with test - API will return mocked data
  const createQuestPage = poManager.getCreateQuestPage();
  await createQuestPage.clickCreateButton();
});
```

### Wait for Request/Response
```typescript
test("Wait for API call", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;
  const helpers = new HelperActions(page, page.context());

  // Wait for specific request
  const requestPromise = helpers.waitForRequest('**/api/quests');
  
  // Trigger action
  const createQuestPage = poManager.getCreateQuestPage();
  await createQuestPage.submitQuest();
  
  // Get request
  const request = await requestPromise;
  console.log('Request URL:', request.url());
  console.log('Request method:', request.method());
});
```

### Listen to All Responses
```typescript
test("Monitor all responses", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;
  const helpers = new HelperActions(page, page.context());

  // Listen to responses
  helpers.onResponse((response) => {
    console.log(`Response: ${response.status()} ${response.url()}`);
  });

  // Continue test - all responses will be logged
});
```

### Abort Requests
```typescript
test("Block analytics calls", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;
  const helpers = new HelperActions(page, page.context());

  // Block analytics
  await helpers.interceptRequests('**/analytics/**', async (route) => {
    await helpers.abortRoute(route);
  });

  // Analytics calls will be blocked
});
```

### Modify Requests
```typescript
test("Modify request headers", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;

  await page.route('**/api/**', async (route) => {
    const headers = route.request().headers();
    headers['X-Custom-Header'] = 'custom-value';
    
    await route.continue({ headers });
  });
});
```

---

## Best Practices

### DO
```typescript
// Use Page Object Model
const createQuestPage = poManager.getCreateQuestPage();
await createQuestPage.clickCreateButton();

// Use descriptive method names
async clickCreateButton() { }  // ✅ Good
async click1() { }             // ❌ Bad

// Wait for elements before interaction
await this.waitForElementVisible('.button');
await this.click('.button');

// Use proper locators
await this.click('button[data-testid="submit"]');  // ✅ Good
await this.click('div > div > button');            // ❌ Bad (fragile)

// Handle async operations
await this.submitQuest();
await this.waitForPageLoadIdle();

// Extract reusable actions to BasePage
// Don't duplicate click/fill logic
```

### ❌ DON'T
```typescript
// Don't bypass Page Objects
await page.click('.button');  // ❌ Use page object method instead

// Don't hardcode waits
await page.waitForTimeout(5000);  // ❌ Use waitForElement instead

// Don't use brittle selectors
await this.click('body > div:nth-child(3) > button');  // ❌ Fragile

// Don't create god objects
class MegaPage {
  // 50 methods
  // ❌ Split into multiple page objects
}

// Don't duplicate logic
// ✅ Put common actions in BasePage
```

---

## Examples

### Example 1: Complete Flow
```typescript
test.describe("Quest Management Flow", () => {
  
  test("Create, update, and delete quest", async ({ poManager }) => {
    // Create
    const createPage = poManager.getCreateQuestPage();
    await createPage.clickCreateButton();
    await createPage.fillQuestForm({
      name: "Test Quest",
      description: "Test Description"
    });
    await createPage.submitQuest();
    
    const message = await createPage.getSuccessMessage();
    expect(message).toContain("created successfully");

    // Update
    const updatePage = poManager.getUpdateQuestPage();
    await updatePage.navigateToQuest("Test Quest");
    await updatePage.updateDescription("Updated Description");
    await updatePage.save();
    
    const updated = await updatePage.getSuccessMessage();
    expect(updated).toContain("updated");
  });
});
```

### Example 2: Form Validation
```typescript
test("Validate form fields", async ({ poManager }) => {
  const createPage = poManager.getCreateQuestPage();
  
  await createPage.clickCreateButton();
  
  // Try submit without filling
  await createPage.submitQuest();
  
  // Check validation messages
  const nameError = await createPage.page.locator('.name-error').textContent();
  expect(nameError).toContain("Name is required");
  
  // Fill and verify button enabled
  await createPage.fillQuestForm({
    name: "Valid Name",
    description: "Valid Description"
  });
  
  const isEnabled = await createPage.isSubmitButtonEnabled();
  expect(isEnabled).toBe(true);
});
```

### Example 3: File Upload
```typescript
test("Upload file", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;
  const helpers = new HelperActions(page, page.context());

  await helpers.uploadFile('input[type="file"]', './test-files/image.png');
  
  // Verify upload
  const fileName = await page.locator('.file-name').textContent();
  expect(fileName).toBe('image.png');
});
```

### Example 4: Dialog Handling
```typescript
test("Handle confirmation dialog", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;
  const helpers = new HelperActions(page, page.context());

  // Setup dialog handler BEFORE triggering
  await helpers.takeDialogAction('accept');
  
  // Trigger action that shows dialog
  await page.click('.delete-button');
  
  // Dialog will be accepted automatically
});
```

### Example 5: Screenshot on Failure
```typescript
test("Take screenshot on failure", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;
  const helpers = new HelperActions(page, page.context());

  try {
    await poManager.getCreateQuestPage().submitQuest();
    // ... test logic
  } catch (error) {
    await helpers.takeScreenshot(`./screenshots/failure-${Date.now()}.png`);
    throw error;
  }
});
```

### Example 6: Multi-Page Flow
```typescript
test("Navigate through multiple pages", async ({ poManager }) => {
  const createPage = poManager.getCreateQuestPage();
  const updatePage = poManager.getUpdateQuestPage();

  // Create quest
  await createPage.clickCreateButton();
  await createPage.fillQuestForm({
    name: "Multi-Page Test",
    description: "Description"
  });
  await createPage.submitQuest();

  // Navigate to update page
  await updatePage.navigateToQuest("Multi-Page Test");
  await updatePage.updateName("Updated Name");
  await updatePage.save();

  // Verify
  const name = await updatePage.getQuestName();
  expect(name).toBe("Updated Name");
});
```

---

## Troubleshooting

### Issue: "Page not found" or "Element not found"

**Cause**: Element not loaded yet

**Solution**:
```typescript
// Wrong
await this.click('.button');

// Correct
await this.waitForElementVisible('.button');
await this.click('.button');
```

### Issue: "Timeout waiting for element"

**Cause**: Wrong selector or element doesn't exist

**Solution**:
```typescript
// Debug: Check if element exists
const exists = await this.elementExists('.my-selector');
console.log('Element exists:', exists);

// Or pause to inspect
await this.pause();
```

### Issue: Auth not working

**Cause**: Wrong domain or token

**Solution**:
```env
# Check .env.stage
domain=.example.com  # Must match your app domain
AUTH_TOKEN=valid-token-here
```

### Issue: Flaky tests

**Cause**: Race conditions, timing issues

**Solution**:
```typescript
// ❌ Don't use fixed waits
await this.waitForSeconds(2);

// ✅ Use smart waits
await this.waitForElementVisible('.element');
await this.waitForPageLoadIdle();
```

---

## Summary

| Feature | Usage | Location |
|---------|-------|----------|
| **Page Objects** | Encapsulate page logic | `src/ui/pages/` |
| **Base Page** | Common actions | `src/ui/pages/basePage.ts` |
| **Helper Actions** | Network, upload | `src/ui/actions/helperActions.ts` |
| **Auth** | Pre-authentication | `src/ui/uiUtils/authUtils.ts` |
| **Fixtures** | Test setup | `tests/baseUiTest.ts` |

---

[← Back to Main README](../README.md) | [Next: Fixtures Guide →](./FIXTURES.md)