# Test Examples

Comprehensive collection of common testing patterns and real-world examples.

---

## Table of Contents

- [API Testing Examples](#api-testing-examples)
- [UI Testing Examples](#ui-testing-examples)
- [Database Testing Examples](#database-testing-examples)
- [Advanced Patterns](#advanced-patterns)

---

## API Testing Examples

### Example 1: Complete CRUD Operations
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";

test.describe("Article CRUD Operations", () => {
  let authToken: string;
  let articleSlug: string;

  test("1. Register and login user", async ({ rwService }) => {
    // Register
    const registerPayload = BaseTest.generator.registerUser();
    const registerResponse = await rwService.registerUser(registerPayload);
    await rwService.assertStatus(registerResponse, 201);
    
    const registerBody = await registerResponse.json();
    const email = registerBody.user.email;
    
    // Login
    const loginPayload = BaseTest.generator.loginUser(email, "password");
    const loginResponse = await rwService.loginUser(loginPayload);
    await rwService.assertStatus(loginResponse, 200);
    
    const loginBody = await loginResponse.json();
    authToken = loginBody.user.token;
    
    BaseTest.logger.info(`User authenticated: ${email}`);
  });

  test("2. Create article", async ({ apiClient }) => {
    const payload = {
      article: {
        title: `Test Article ${Date.now()}`,
        description: "Test description",
        body: "Test body content",
        tagList: ["test", "automation"]
      }
    };
    
    const response = await apiClient.callApi({
      path_param: "/articles",
      method: "POST",
      headers: { "Authorization": `Token ${authToken}` },
      payload: payload
    });
    
    await expect(response.status()).toBe(201);
    
    const body = await response.json();
    articleSlug = body.article.slug;
    
    BaseTest.logger.info(`Article created: ${articleSlug}`);
  });

  test("3. Get article", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: `/articles/${articleSlug}`,
      method: "GET"
    });
    
    await expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.article.slug).toBe(articleSlug);
    expect(body.article.tagList).toContain("test");
  });

  test("4. Update article", async ({ apiClient }) => {
    const payload = {
      article: {
        title: "Updated Title",
        description: "Updated description"
      }
    };
    
    const response = await apiClient.callApi({
      path_param: `/articles/${articleSlug}`,
      method: "PUT",
      headers: { "Authorization": `Token ${authToken}` },
      payload: payload
    });
    
    await expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.article.title).toBe("Updated Title");
  });

  test("5. Delete article", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: `/articles/${articleSlug}`,
      method: "DELETE",
      headers: { "Authorization": `Token ${authToken}` }
    });
    
    await expect(response.status()).toBe(204);
    
    BaseTest.logger.info(`Article deleted: ${articleSlug}`);
  });

  test("6. Verify article deleted", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: `/articles/${articleSlug}`,
      method: "GET"
    });
    
    await expect(response.status()).toBe(404);
  });
});
```

### Example 2: Data-Driven Testing
```typescript
const testCases = [
  { 
    name: "Valid user",
    email: "valid@example.com",
    password: "ValidPass123",
    expectedStatus: 201
  },
  { 
    name: "Invalid email",
    email: "invalid-email",
    password: "password",
    expectedStatus: 422
  },
  { 
    name: "Short password",
    email: "test@example.com",
    password: "123",
    expectedStatus: 422
  }
];

testCases.forEach(({ name, email, password, expectedStatus }) => {
  test(`Register user: ${name}`, async ({ rwService }) => {
    const payload = {
      user: { 
        username: `user_${Date.now()}`,
        email: email,
        password: password
      }
    };
    
    const response = await rwService.registerUser(payload);
    await rwService.assertStatus(response, expectedStatus);
    
    if (expectedStatus === 422) {
      await rwService.validateField(response, "errors", expect.anything());
    }
  });
});
```

### Example 3: External API Integration
```typescript
test.describe("External API Integration", () => {
  
  test("Fetch data from JSONPlaceholder", async ({ rwService }) => {
    const response = await rwService.getExternalUser(1);
    
    await rwService.assertStatus(response, 200);
    await rwService.validateField(response, "id", 1);
    await rwService.validateField(response, "name", "Leanne Graham");
    
    const body = await response.json();
    expect(body.address).toBeDefined();
    expect(body.company).toBeDefined();
  });

  test("Search GitHub repositories", async ({ rwService }) => {
    const response = await rwService.searchGitHubRepos("playwright");
    
    await rwService.assertStatus(response, 200);
    
    const body = await response.json();
    expect(body.total_count).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);
    
    const topRepo = body.items[0];
    expect(topRepo).toHaveProperty('name');
    expect(topRepo).toHaveProperty('stargazers_count');
    
    BaseTest.logger.info(`Top repo: ${topRepo.full_name}`);
  });

  test("Call webhook", async ({ rwService }) => {
    const webhookUrl = "https://webhook.site/unique-id";
    
    const payload = {
      event: "test_event",
      timestamp: new Date().toISOString(),
      data: {
        testId: "TC_001",
        status: "running"
      }
    };
    
    const response = await rwService.callWebhook(webhookUrl, payload);
    await rwService.assertStatus(response, 200);
  });
});
```

### Example 4: Error Handling
```typescript
test.describe("Error Handling", () => {
  
  test("Handle 404 Not Found", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: "/articles/non-existent-slug",
      method: "GET"
    });
    
    await expect(response.status()).toBe(404);
  });

  test("Handle 422 Validation Error", async ({ rwService }) => {
    const invalidPayload = {
      user: {
        username: "a",  // Too short
        email: "invalid-email",
        password: "123"  // Too short
      }
    };
    
    const response = await rwService.registerUser(invalidPayload);
    await rwService.assertStatus(response, 422);
    
    const body = await response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.email).toContain("is invalid");
  });

  test("Handle 401 Unauthorized", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: "/articles",
      method: "POST",
      payload: { article: { title: "Test" } }
      // No auth header
    });
    
    await expect(response.status()).toBe(401);
  });
});
```

---

## UI Testing Examples

### Example 1: Form Submission
```typescript
test.describe("Quest Creation Form", () => {
  
  test("Create quest with valid data", async ({ poManager }) => {
    const createPage = poManager.getCreateQuestPage();
    
    await createPage.clickCreateButton();
    
    await createPage.fillQuestForm({
      name: "Test Quest",
      description: "This is a test quest for automation"
    });
    
    await createPage.submitQuest();
    
    const message = await createPage.getSuccessMessage();
    expect(message).toContain("success");
  });

  test("Show validation for empty form", async ({ poManager }) => {
    const createPage = poManager.getCreateQuestPage();
    const page = createPage.page;
    
    await createPage.clickCreateButton();
    await createPage.submitQuest();
    
    const nameError = await page.locator('.name-error').textContent();
    expect(nameError).toContain("required");
  });
});
```

### Example 2: Network Interception
```typescript
test.describe("Mocked API Responses", () => {
  
  test("Mock successful submission", async ({ poManager }) => {
    const page = poManager.getCreateQuestPage().page;
    const context = page.context();
    const helpers = new HelperActions(page, context);
    
    // Mock API response
    await helpers.interceptRequests('**/api/quests', async (route) => {
      await helpers.fulfillRoute(route, {
        success: true,
        message: "Quest created successfully",
        quest: { id: 1, name: "Mocked Quest" }
      });
    });
    
    const createPage = poManager.getCreateQuestPage();
    await createPage.clickCreateButton();
    await createPage.fillQuestForm({
      name: "Test Quest",
      description: "Description"
    });
    await createPage.submitQuest();
    
    const message = await createPage.getSuccessMessage();
    expect(message).toContain("successfully");
  });

  test("Mock error response", async ({ poManager }) => {
    const page = poManager.getCreateQuestPage().page;
    const context = page.context();
    const helpers = new HelperActions(page, context);
    
    await helpers.interceptRequests('**/api/quests', async (route) => {
      await helpers.fulfillRoute(route, {
        error: "Server error"
      }, 500);
    });
    
    const createPage = poManager.getCreateQuestPage();
    await createPage.clickCreateButton();
    await createPage.submitQuest();
    
    const errorMessage = await page.locator('.error-message').textContent();
    expect(errorMessage).toContain("error");
  });
});
```

### Example 3: File Upload
```typescript
test("Upload file", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;
  const context = page.context();
  const helpers = new HelperActions(page, context);
  
  await helpers.uploadFile('input[type="file"]', './test-files/document.pdf');
  
  // Wait for upload to complete
  await page.waitForSelector('.upload-complete');
  
  const fileName = await page.locator('.file-name').textContent();
  expect(fileName).toBe('document.pdf');
});
```

---

## Database Testing Examples

### Example 1: API to Database Verification
```typescript
test("Verify user in database after registration", async ({ rwService }) => {
  const payload = BaseTest.generator.registerUser();
  const response = await rwService.registerUser(payload);
  
  await rwService.assertStatus(response, 201);
  
  const { email, username } = (await response.json()).user;
  
  // Query database
  const dbResults = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  expect(dbResults.length).toBe(1);
  expect(dbResults[0].email).toBe(email);
  expect(dbResults[0].username).toBe(username);
  
  // Verify password is hashed
  expect(dbResults[0].password).not.toBe(payload.user.password);
  expect(dbResults[0].password).toMatch(/^\$2[ayb]\$.{56}$/);
});
```

### Example 2: Complex Join Query
```typescript
test("Verify user's articles with tags", async () => {
  const userEmail = "author@example.com";

  const results = await BaseTest.dbClient.query(
    'postgres',
    `SELECT 
       u.email,
       a.slug,
       a.title,
       ARRAY_AGG(t.name) as tags
     FROM users u
     JOIN articles a ON a.author_id = u.id
     LEFT JOIN article_tags at ON at.article_id = a.id
     LEFT JOIN tags t ON t.id = at.tag_id
     WHERE u.email = $1
     GROUP BY u.id, a.id
     ORDER BY a.created_at DESC`,
    [userEmail]
  );

  expect(results.length).toBeGreaterThan(0);
  
  results.forEach(row => {
    expect(row.email).toBe(userEmail);
    expect(row.tags).toBeInstanceOf(Array);
  });
});
```

### Example 3: Data Cleanup
```typescript
test.describe("Article Tests with Cleanup", () => {
  const createdSlugs: string[] = [];

  test.afterAll(async () => {
    if (createdSlugs.length > 0) {
      const placeholders = createdSlugs.map((_, i) => `$${i + 1}`).join(', ');
      
      await BaseTest.dbClient.query(
        'postgres',
        `DELETE FROM articles WHERE slug IN (${placeholders})`,
        createdSlugs
      );
      
      BaseTest.logger.info(`Cleaned up ${createdSlugs.length} articles`);
    }
  });

  test("Create article", async ({ rwService }) => {
    const response = await rwService.createArticle(payload, headers);
    const { slug } = (await response.json()).article;
    
    createdSlugs.push(slug);
  });
});
```

---

## Advanced Patterns

### Example 1: Retry Logic
```typescript
test("API with retry logic", async ({ rwService }) => {
  let attempts = 0;
  const maxAttempts = 3;
  let response;
  
  while (attempts < maxAttempts) {
    try {
      response = await rwService.getArticles();
      
      if (response.status() === 200) {
        break;
      }
    } catch (error) {
      attempts++;
      BaseTest.logger.warn(`Attempt ${attempts} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  await rwService.assertStatus(response, 200);
});
```

### Example 2: Performance Testing
```typescript
test("Measure API response time", async ({ rwService }) => {
  const startTime = Date.now();
  
  const response = await rwService.getArticles();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  await rwService.assertStatus(response, 200);
  
  expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
  
  BaseTest.logger.info(`API response time: ${duration}ms`);
});
```

### Example 3: Parallel Requests
```typescript
test("Execute requests in parallel", async ({ rwService }) => {
  const requests = [
    rwService.getArticles({ limit: 10 }),
    rwService.getArticles({ tag: "test" }),
    rwService.getArticles({ author: "john" })
  ];
  
  const responses = await Promise.all(requests);
  
  for (const response of responses) {
    await rwService.assertStatus(response, 200);
  }
  
  BaseTest.logger.info("All parallel requests completed successfully");
});
```

### Example 4: Conditional Test Execution
```typescript
test("Run only in staging environment", async ({ rwService }) => {
  test.skip(BaseTest.config.ENV !== 'stage', 'Only runs in staging');
  
  // Test code that should only run in staging
  const response = await rwService.dangerousOperation();
  await rwService.assertStatus(response, 200);
});

test("Skip if database disabled", async ({ rwService }) => {
  test.skip(!BaseTest.config.db.enabled, 'Database testing disabled');
  
  const dbResults = await BaseTest.dbClient.query('postgres', 'SELECT 1', []);
  expect(dbResults.length).toBe(1);
});
```

### Example 5: Custom Assertions
```typescript
async function assertArticleStructure(response: APIResponse) {
  const body = await response.json();
  
  expect(body.article).toBeDefined();
  expect(body.article.slug).toBeDefined();
  expect(body.article.title).toBeDefined();
  expect(body.article.author).toBeDefined();
  expect(body.article.tagList).toBeInstanceOf(Array);
}

test("Verify article structure", async ({ rwService }) => {
  const response = await rwService.getArticles();
  await rwService.assertStatus(response, 200);
  
  const body = await response.json();
  for (const article of body.articles) {
    await assertArticleStructure({ json: async () => ({ article }) } as any);
  }
});
```

---

## Summary

These examples demonstrate:

- Complete CRUD operations
- Data-driven testing
- External API integration
- Error handling patterns
- Form submission and validation
- Network interception and mocking
- File upload handling
- Database verification
- Complex SQL queries
- Data cleanup strategies
- Performance testing
- Parallel execution
- Conditional test execution
- Custom assertions

---

[Back to Main README](../README.md)