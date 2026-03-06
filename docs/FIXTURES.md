# Test Fixtures Guide

Complete guide to using Playwright fixtures in the framework.

---

## Table of Contents

- [Overview](#overview)
- [Available Fixtures](#available-fixtures)
- [Basic Usage](#basic-usage)
- [Overriding Fixtures](#overriding-fixtures)
- [Advanced Patterns](#advanced-patterns)

---

## Overview

The framework uses Playwright's fixture system for clean dependency management:

- **Fixtures** - Test-specific dependencies (apiContext, apiClient, rwService)
- **Static Utilities** - Common tools (logger, validator, generator, dbClient) via BaseTest

This hybrid approach minimizes boilerplate while providing maximum flexibility.

---

## Available Fixtures

### API Test Fixtures

| Fixture | Type | Description | Auto Cleanup |
|---------|------|-------------|--------------|
| `apiContext` | `APIRequestContext` | Playwright request context with baseURL | Yes |
| `apiClient` | `ApiClient` | Custom API client wrapper | Yes |
| `rwService` | `realWorldService` | RealWorld API service with endpoints | Yes |

### UI Test Fixtures

| Fixture | Type | Description | Auto Cleanup |
|---------|------|-------------|--------------|
| `basePage` | `BasePage` | Base page with common actions | Yes |
| `poManager` | `POManager` | Page Object Manager | Yes |

### Static Utilities (via BaseTest)

| Utility | Access | Description |
|---------|--------|-------------|
| `logger` | `BaseTest.logger` | Winston logger |
| `validator` | `BaseTest.validator` | Response validators |
| `generator` | `BaseTest.generator` | Test data generators |
| `dbClient` | `BaseTest.dbClient` | Database client |
| `config` | `BaseTest.config` | Configuration |
| `allure` | `BaseTest.allure` | Allure reporting |

---

## Basic Usage

### API Test
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";

test.describe("User API Tests", () => {
  
  test("Register user", async ({ rwService }) => {
    // Use static utilities
    const payload = BaseTest.generator.registerUser();
    BaseTest.logger.info("Registering user...");
    
    // Use fixture
    const response = await rwService.registerUser(payload);
    
    // Assertions
    await rwService.assertStatus(response, 201);
  });
});
```

### UI Test
```typescript
import { test, expect } from '../baseUiTest.js';

test.describe("Create Quest", () => {
  
  test("Create new quest", async ({ poManager }) => {
    const createQuestPage = poManager.getCreateQuestPage();
    
    await createQuestPage.clickCreateButton();
    await createQuestPage.fillQuestForm({ 
      name: 'Test Quest', 
      description: 'Description' 
    });
  });
});
```

---

## Overriding Fixtures

### Scope Levels

1. **File-level** - Affects all tests in current file
2. **Describe-level** - Affects tests in specific describe block
3. **Test-level** - Affects single test only

### File-Level Override
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";
import { request } from "@playwright/test";

// Override baseURL for ALL tests in this file
test.use({ 
  apiContext: async ({}, use) => {
    const context = await request.newContext({
      baseURL: "https://api.github.com",
      extraHTTPHeaders: {
        "Accept": "application/vnd.github.v3+json",
      }
    });
    await use(context);
    await context.dispose();
  }
});

test.describe("GitHub API Tests", () => {
  test("Get user", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: "/users/octocat",
      method: "GET"
    });
    await expect(response.status()).toBe(200);
  });
});
```

### Describe-Level Override
```typescript
test.describe("Production API Tests", () => {
  
  // Override for this describe block ONLY
  test.use({ 
    apiContext: async ({}, use) => {
      const context = await request.newContext({
        baseURL: "https://api.production.com",
        extraHTTPHeaders: {
          "Content-Type": "application/json",
          "X-Environment": "production"
        }
      });
      await use(context);
      await context.dispose();
    }
  });
  
  test("Test on production", async ({ rwService }) => {
    const response = await rwService.getArticles();
    await rwService.assertStatus(response, 200);
  });
});

test.describe("Staging Tests", () => {
  // Uses default baseURL from config
  
  test("Test on staging", async ({ rwService }) => {
    const response = await rwService.getArticles();
    await rwService.assertStatus(response, 200);
  });
});
```

### Test-Level Override
```typescript
test("Test with custom headers", async ({ rwService }) => {
  const authToken = "custom-token";
  
  test.use({
    apiContext: async ({}, use) => {
      const context = await request.newContext({
        baseURL: BaseTest.config.api_base_url,
        extraHTTPHeaders: {
          "Authorization": `Token ${authToken}`
        }
      });
      await use(context);
      await context.dispose();
    }
  });
  
  const response = await rwService.createArticle(payload, {});
  await rwService.assertStatus(response, 201);
});
```

### UI Test Override
```typescript
test.describe("Mobile Tests", () => {
  
  // Override viewport for mobile
  test.use({ 
    viewport: { width: 375, height: 667 }
  });
  
  test("Mobile navigation", async ({ poManager }) => {
    // Test runs with mobile viewport
  });
});
```

---

## Advanced Patterns

### Multiple Environments
```typescript
test.describe("Cross-Environment Tests", () => {
  
  test.describe("Staging", () => {
    test.use({
      apiContext: async ({}, use) => {
        const context = await request.newContext({
          baseURL: "https://api.staging.com"
        });
        await use(context);
        await context.dispose();
      }
    });
    
    test("Staging test", async ({ rwService }) => {
      // Uses staging URL
    });
  });
  
  test.describe("Production", () => {
    test.use({
      apiContext: async ({}, use) => {
        const context = await request.newContext({
          baseURL: "https://api.production.com"
        });
        await use(context);
        await context.dispose();
      }
    });
    
    test("Production test", async ({ rwService }) => {
      // Uses production URL
    });
  });
});
```

### Custom Timeouts
```typescript
test("Long operation", async ({ rwService }) => {
  test.use({
    apiContext: async ({}, use) => {
      const context = await request.newContext({
        baseURL: BaseTest.config.api_base_url,
        timeout: 60000  // 60 second timeout
      });
      await use(context);
      await context.dispose();
    }
  });
  
  const response = await rwService.longRunningOperation();
});
```

### Authentication Override
```typescript
test.describe("Authenticated Tests", () => {
  let authToken: string;

  test.beforeAll(async () => {
    // Get auth token
    authToken = "token-from-login";
  });
  
  test.use({
    apiContext: async ({}, use) => {
      const context = await request.newContext({
        baseURL: BaseTest.config.api_base_url,
        extraHTTPHeaders: {
          "Authorization": `Token ${authToken}`
        }
      });
      await use(context);
      await context.dispose();
    }
  });
  
  test("Create article", async ({ rwService }) => {
    // Automatically authenticated
  });
});
```

---

## Best Practices

### DO
```typescript
// Use fixtures for test-specific dependencies
test("example", async ({ rwService }) => {
  // rwService injected automatically
});

// Use BaseTest for common utilities
const payload = BaseTest.generator.registerUser();
BaseTest.logger.info("Test starting...");

// Override at appropriate scope
test.describe("External API", () => {
  test.use({ /* override */ });
});

// Let fixtures handle cleanup
// No manual disposal needed
```

### DON'T
```typescript
// Don't override too late
test("example", async ({ rwService }) => {
  test.use({ /* ... */ });  // Too late
});

// Don't pass common utilities as fixtures
test("example", async ({ rwService, logger, generator }) => {
  // Too much boilerplate
});

// Don't manually dispose fixtures
test("example", async ({ apiContext }) => {
  await apiContext.dispose();  // Fixture handles this
});
```

---

## Summary

| Feature | Scope | Usage |
|---------|-------|-------|
| **Fixtures** | Test-specific | `async ({ rwService }) => { }` |
| **Static Utilities** | Global | `BaseTest.logger.info()` |
| **test.use()** | File/Describe/Test | Override fixture values |
| **Auto Cleanup** | Automatic | Fixtures self-dispose |

---

[Back to Main README](../README.md) | [Next: Examples](./EXAMPLES.md)