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

### Two Approaches

Playwright provides two ways to override configuration:

#### Approach 1: Built-in Playwright Options (Recommended for Simple Cases)

Use Playwright's native test options for common configurations:
```typescript
test.describe("API Tests with Custom Config", () => {
  
  // Override built-in Playwright options
  test.use({
    baseURL: "https://api.example.com",
    extraHTTPHeaders: { 
      "Authorization": "Bearer token123",
      "X-Custom-Header": "value"
    }
  });

  test("Test with custom config", async ({ rwService }) => {
    // Uses baseURL and headers from test.use()
    const response = await rwService.registerUser(payload);
    await rwService.assertStatus(response, 201);
  });
});
```

**Available Built-in Options:**

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `baseURL` | `string` | Base URL for API requests | `"https://api.example.com"` |
| `extraHTTPHeaders` | `object` | Additional HTTP headers | `{ "Authorization": "Bearer token" }` |
| `viewport` | `object` | Browser viewport size (UI tests) | `{ width: 1280, height: 720 }` |
| `storageState` | `string/object` | Authentication state | `{ cookies: [...], origins: [...] }` |
| `timeout` | `number` | Test timeout in milliseconds | `60000` |
| `locale` | `string` | Browser locale | `"en-US"` |
| `timezoneId` | `string` | Timezone | `"America/New_York"` |
| `permissions` | `string[]` | Browser permissions | `["geolocation"]` |

**When to use:** For simple configuration changes without custom logic.

#### Approach 2: Custom Fixture Override (Advanced)

Override the fixture implementation for complex scenarios:
```typescript
import { request } from "@playwright/test";

test.describe("Advanced Override", () => {
  
  // Override custom fixture with full control
  test.use({
    apiContext: async ({}, use) => {
      const context = await request.newContext({
        baseURL: "https://api.example.com",
        extraHTTPHeaders: { "Authorization": "Bearer token123" },
        timeout: 60000
      });
      
      // Add custom logic here
      BaseTest.logger.info("Custom API context created");
      
      await use(context);
      await context.dispose();
      
      BaseTest.logger.info("Custom API context disposed");
    }
  });

  test("Test with custom fixture", async ({ rwService }) => {
    // Uses overridden apiContext
  });
});
```

**When to use:** When you need custom logic, logging, or complex setup.

### Comparison Table

| Feature | Built-in Options | Custom Fixture Override |
|---------|------------------|-------------------------|
| **Syntax** | Simple object | Async function |
| **Use Case** | Simple config changes | Complex setup logic |
| **Custom Logic** | No | Yes (setup/teardown) |
| **Performance** | Faster | Slightly slower |
| **Maintenance** | Easier | More complex |
| **Logging** | No | Yes |
| **Dynamic Values** | Limited | Full control |
| **Recommended For** | Most common scenarios | Advanced scenarios |

### Scope Levels

Both approaches support three scope levels:

1. **File-level** - Affects all tests in current file
2. **Describe-level** - Affects tests in specific describe block
3. **Test-level** - Affects single test only

---

## Common Usage Patterns

### Pattern 1: Simple URL Override (Built-in Options)
```typescript
test.describe("External API Tests", () => {
  
  // Simple override using built-in options
  test.use({
    baseURL: "https://api.github.com",
    extraHTTPHeaders: {
      "Accept": "application/vnd.github.v3+json"
    }
  });

  test("Get GitHub user", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: "/users/octocat",
      method: "GET"
    });
    await expect(response.status()).toBe(200);
  });
});
```

### Pattern 2: Environment-Specific Configuration (Built-in Options)
```typescript
const environments = {
  stage: "https://api.staging.com",
  prod: "https://api.production.com"
};

test.describe("Multi-Environment Tests", () => {
  
  test.use({
    baseURL: environments[process.env.ENV || 'stage']
  });
  
  test("runs in selected environment", async ({ rwService }) => {
    // Uses environment-specific URL
  });
});
```

### Pattern 3: Dynamic Authentication (Custom Fixture)
```typescript
test.describe("Authenticated Tests", () => {
  let authToken: string;

  test.beforeAll(async () => {
    // Fetch auth token dynamically
    const loginResponse = await fetch("https://api.example.com/login", {
      method: "POST",
      body: JSON.stringify({ email: "test@test.com", password: "password" })
    });
    const data = await loginResponse.json();
    authToken = data.token;
  });

  // Custom fixture override with dynamic token
  test.use({
    apiContext: async ({}, use) => {
      const context = await request.newContext({
        baseURL: BaseTest.config.api_base_url,
        extraHTTPHeaders: {
          "Authorization": `Bearer ${authToken}`  // Dynamic value
        }
      });
      
      BaseTest.logger.info(`Using auth token: ${authToken.substring(0, 10)}...`);
      
      await use(context);
      await context.dispose();
    }
  });

  test("Create article with auth", async ({ rwService }) => {
    // Automatically authenticated with dynamic token
  });
});
```

### Pattern 4: Per-Test Headers (Built-in Options)
```typescript
test.describe("Mixed Authentication", () => {
  
  test("Test without auth", async ({ rwService }) => {
    // Uses default config
    const response = await rwService.getArticles();
    await rwService.assertStatus(response, 200);
  });

  test.describe("Authenticated subset", () => {
    test.use({
      extraHTTPHeaders: {
        "Authorization": "Bearer specific-token"
      }
    });
    
    test("Test with auth", async ({ rwService }) => {
      // Uses auth header
      const response = await rwService.createArticle(payload, {});
      await rwService.assertStatus(response, 201);
    });
  });
});
```

### Pattern 5: Custom Logging (Custom Fixture)
```typescript
test.describe("Tests with Request Logging", () => {
  
  test.use({
    apiContext: async ({}, use) => {
      const context = await request.newContext({
        baseURL: BaseTest.config.api_base_url
      });
      
      // Custom logging before test
      BaseTest.logger.info("=== API Context Created ===");
      BaseTest.logger.info(`Base URL: ${BaseTest.config.api_base_url}`);
      
      await use(context);
      
      // Custom logging after test
      BaseTest.logger.info("=== API Context Disposed ===");
      
      await context.dispose();
    }
  });

  test("Test with logging", async ({ rwService }) => {
    // Logs will show context lifecycle
  });
});
```

### Pattern 6: Multiple Describe Blocks with Different Configs (Built-in Options)
```typescript
test.describe("Production API Tests", () => {
  
  test.use({
    baseURL: "https://api.production.com",
    extraHTTPHeaders: {
      "X-Environment": "production"
    }
  });
  
  test("Production test", async ({ rwService }) => {
    const response = await rwService.getArticles();
    await rwService.assertStatus(response, 200);
  });
});

test.describe("Staging API Tests", () => {
  
  test.use({
    baseURL: "https://api.staging.com",
    extraHTTPHeaders: {
      "X-Environment": "staging"
    }
  });
  
  test("Staging test", async ({ rwService }) => {
    const response = await rwService.getArticles();
    await rwService.assertStatus(response, 200);
  });
});
```

### Pattern 7: UI Test Viewport Override (Built-in Options)
```typescript
test.describe("Responsive Design Tests", () => {
  
  test.describe("Mobile Tests", () => {
    test.use({ 
      viewport: { width: 375, height: 667 }  // iPhone SE
    });
    
    test("Mobile navigation", async ({ poManager }) => {
      // Test runs with mobile viewport
    });
  });

  test.describe("Tablet Tests", () => {
    test.use({ 
      viewport: { width: 768, height: 1024 }  // iPad
    });
    
    test("Tablet layout", async ({ poManager }) => {
      // Test runs with tablet viewport
    });
  });

  test.describe("Desktop Tests", () => {
    test.use({ 
      viewport: { width: 1920, height: 1080 }  // Full HD
    });
    
    test("Desktop features", async ({ poManager }) => {
      // Test runs with desktop viewport
    });
  });
});
```

---

## Complete Examples

### Example 1: Built-in Options (Simple Override)
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";

test.describe("GitHub API Integration", () => {
  
  // Simple override - no custom fixture needed
  test.use({
    baseURL: "https://api.github.com",
    extraHTTPHeaders: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Playwright-Tests"
    }
  });

  test("Get repository", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: "/repos/microsoft/playwright",
      method: "GET"
    });
    
    await expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.name).toBe("playwright");
    expect(body.stargazers_count).toBeGreaterThan(0);
  });

  test("Search repositories", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: "/search/repositories",
      method: "GET",
      query_params: { q: "playwright", sort: "stars" }
    });
    
    await expect(response.status()).toBe(200);
  });
});
```

### Example 2: Custom Fixture Override (Advanced)
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";
import { request } from "@playwright/test";

test.describe("Production Tests with Monitoring", () => {
  
  // Custom fixture with logging and monitoring
  test.use({
    apiContext: async ({}, use) => {
      const startTime = Date.now();
      
      const context = await request.newContext({
        baseURL: "https://api.production.com",
        extraHTTPHeaders: {
          "Authorization": "Bearer prod-token",
          "X-Request-ID": `test-${Date.now()}`
        },
        timeout: 30000
      });
      
      BaseTest.logger.info("Production context initialized");
      BaseTest.logger.info(`Request ID: test-${Date.now()}`);
      
      await use(context);
      
      const duration = Date.now() - startTime;
      BaseTest.logger.info(`Test completed in ${duration}ms`);
      
      await context.dispose();
    }
  });

  test("Production endpoint test", async ({ rwService }) => {
    const response = await rwService.getArticles();
    await rwService.assertStatus(response, 200);
  });
});
```

### Example 3: Mixed Approach
```typescript
test.describe("API Tests", () => {
  
  // Default tests use config baseURL
  test("Default config test", async ({ rwService }) => {
    const response = await rwService.getArticles();
    await rwService.assertStatus(response, 200);
  });

  test.describe("External API Subset", () => {
    // Simple override for external API
    test.use({
      baseURL: "https://jsonplaceholder.typicode.com"
    });
    
    test("External API test", async ({ apiClient }) => {
      const response = await apiClient.callApi({
        path_param: "/posts/1",
        method: "GET"
      });
      await expect(response.status()).toBe(200);
    });
  });

  test.describe("Authenticated Subset", () => {
    // Custom fixture for complex auth
    test.use({
      apiContext: async ({}, use) => {
        const token = await getAuthTokenFromExternalService();
        
        const context = await request.newContext({
          baseURL: BaseTest.config.api_base_url,
          extraHTTPHeaders: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        await use(context);
        await context.dispose();
      }
    });
    
    test("Authenticated test", async ({ rwService }) => {
      // Uses dynamic auth token
    });
  });
});
```

---

## Best Practices

### DO
```typescript
// Use built-in options for simple cases
test.use({
  baseURL: "https://api.example.com",
  extraHTTPHeaders: { "X-Custom": "value" }
});

// Use custom fixtures for complex logic
test.use({
  apiContext: async ({}, use) => {
    const token = await fetchDynamicToken();
    const context = await request.newContext({
      baseURL: "...",
      extraHTTPHeaders: { "Authorization": `Bearer ${token}` }
    });
    await use(context);
    await context.dispose();
  }
});

// Override at appropriate scope
test.describe("External API", () => {
  test.use({ /* override */ });
});

// Use BaseTest for common utilities
const payload = BaseTest.generator.registerUser();
BaseTest.logger.info("Test starting...");
```

### DON'T
```typescript
// Don't override inside test function
test("example", async ({ rwService }) => {
  test.use({ /* ... */ });  // ERROR: Too late
});

// Don't use custom fixture for simple cases
test.use({
  apiContext: async ({}, use) => {
    const context = await request.newContext({
      baseURL: "https://api.example.com"  // Just use built-in option!
    });
    await use(context);
    await context.dispose();
  }
});

// Don't pass common utilities as fixtures
test("example", async ({ rwService, logger, generator }) => {
  // Too much boilerplate - use BaseTest instead
});

// Don't manually dispose fixtures
test("example", async ({ apiContext }) => {
  await apiContext.dispose();  // Fixture handles this automatically
});
```

---

## Troubleshooting

### Error: "test.use() called inside test function"

**Problem:**
```typescript
test("example", async ({ rwService }) => {
  test.use({ baseURL: "..." });  // ERROR
});
```

**Solution:**
```typescript
test.describe("example", () => {
  test.use({ baseURL: "..." });  // Correct - before test
  
  test("example", async ({ rwService }) => {
    // ...
  });
});
```

### Error: "Property 'baseURL' does not exist"

**Problem:** Using built-in option with wrong fixture

**Solution:**
```typescript
// Built-in options work directly
test.use({
  baseURL: "https://api.example.com"  // Correct
});

// Custom fixture override needs full implementation
test.use({
  apiContext: async ({}, use) => {
    const context = await request.newContext({
      baseURL: "https://api.example.com"
    });
    await use(context);
    await context.dispose();
  }
});
```

---

## Summary

| Feature | Built-in Options | Custom Fixture Override |
|---------|------------------|-------------------------|
| **Usage** | `test.use({ baseURL: "..." })` | `test.use({ apiContext: async ({}, use) => {...} })` |
| **Scope** | File/Describe/Test | File/Describe/Test |
| **Complexity** | Low | High |
| **Flexibility** | Limited | Full control |
| **Recommended** | Most cases | Advanced scenarios |

**Key Takeaway:** Use built-in options for simple configuration changes (baseURL, headers). Use custom fixture overrides only when you need custom logic, dynamic values, or additional setup/teardown.

---

[Back to Main README](../README.md) | [Next: Examples](./EXAMPLES.md)