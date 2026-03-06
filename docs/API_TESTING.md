# API Testing Guide

Complete guide to API testing in the PlayType framework.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Client](#api-client)
- [Service Layer](#service-layer)
- [Response Validation](#response-validation)
- [Database Validation](#database-validation)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

The framework provides a **dual-mode API client** with comprehensive validation capabilities:

- **Structured calls** (callApi) - With baseURL concatenation
- **Direct calls** (callDirectApi) - Full URL, no baseURL
- **Schema validation** - JSON Schema (AJV) + Zod
- **Database verification** - PostgreSQL & MySQL support
- **Automatic logging** - Request/response tracking
- **Fixture-based** - Clean test isolation

---

## Architecture
```
Test File
    ↓
Fixtures (apiContext, apiClient, rwService)
    ↓
BaseTest (static utilities: logger, validator, generator, dbClient)
    ↓
Service Layer (realWorldService extends BaseService)
    ↓
API Client (callApi, callDirectApi)
    ↓
Playwright APIRequestContext
    ↓
HTTP Request/Response
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **ApiClient** | HTTP request wrapper | `src/api/client.ts` |
| **BaseService** | Service base class | `src/api/services/baseService.ts` |
| **Service Classes** | Endpoint methods | `src/api/services/*/` |
| **Validator** | Response validation | `src/api/validator.ts` |
| **BaseTest** | Test utilities | `tests/BaseApiTest.ts` |

---

## Getting Started

### Basic Test Structure
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";

test.describe("User API Tests", () => {
  
  test("Register user", async ({ rwService }) => {
    // Generate test data
    const payload = BaseTest.generator.registerUser();
    
    // Call API
    const response = await rwService.registerUser(payload);
    
    // Validate
    await rwService.assertStatus(response, 201);
    await rwService.validateField(response, "user.email", payload.user.email);
  });
});
```

### Import Structure
```typescript
// Fixtures and utilities
import { test, expect, BaseTest } from "../../BaseApiTest.js";

// Schemas (optional)
import { userSchema, articleSchema } from "../schemas.js";

// No need to import:
// - logger (use BaseTest.logger)
// - validator (use BaseTest.validator)
// - generator (use BaseTest.generator)
// - dbClient (use BaseTest.dbClient)
```

---

## API Client

### Two Modes of Operation

#### Mode 1: callApi (Structured)

**Use for**: Internal APIs, main application endpoints

**Features**:
- Uses baseURL from config
- Automatic path concatenation
- Shared authentication state
- Cookie persistence

**Example**:
```typescript
const response = await apiClient.callApi({
  path_param: "/users",           // Relative path
  method: "POST",
  payload: { user: { email, password } },
  headers: { "X-Custom": "value" },
  query_params: { limit: 10 }
});

// Actual URL: https://api.example.com/api/users?limit=10
```

#### Mode 2: callDirectApi (Direct)

**Use for**: External APIs, webhooks, third-party services

**Features**:
- Full URL required
- No baseURL concatenation
- Fresh request per call
- Standalone operation

**Example**:
```typescript
const response = await apiClient.callDirectApi({
  url: "https://jsonplaceholder.typicode.com/users/1",  // Full URL
  method: "GET",
  headers: { "Accept": "application/json" },
  query_params: { fields: "name,email" }
});
```

### Complete API Client Interface
```typescript
interface ApiRequestOptions {
  path_param: string;                    // Relative path
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query_params?: string | URLSearchParams | Record<string, any>;
  payload?: object | string;
}

interface DirectCallOptions {
  url: string;                           // Full URL
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query_params?: string | URLSearchParams | Record<string, any>;
  payload?: object | string;
}
```

---

## Service Layer

### Creating a Service
```typescript
// src/api/services/myService/myServiceEndpoints.ts

import { BaseService } from "../baseService.js";
import { APIResponse } from "@playwright/test";
import { ApiClient } from "../../client.js";

export class MyService extends BaseService {
  protected basePath: string;

  constructor(apiClient: ApiClient, basePath: string) {
    super(apiClient);
    this.basePath = basePath;
  }

  // Internal API endpoint (uses callApi)
  async getUsers(filters?: { limit?: number; offset?: number }): Promise<APIResponse> {
    return this.callApi({
      method: "GET",
      path_param: "users",
      query_params: filters
    });
  }

  // External API endpoint (uses callDirectApi)
  async getExternalData(url: string): Promise<APIResponse> {
    return this.callDirectApi({
      url: url,
      method: "GET"
    });
  }
}
```

### Service Methods

**Protected methods** (internal use only):
- `callApi(options)` - Structured API calls
- `callDirectApi(options)` - Direct API calls

**Public methods** (available in tests):
- `assertStatus(response, expectedStatus)` - Status validation
- `validateSchema(response, schema)` - JSON Schema validation
- `validateZodSchema(response, zodSchema)` - Zod validation
- `validateField(response, fieldPath, expectedValue)` - Field validation
- `assertDbQueryResult(queryResult, schemaOrField, expectedValue)` - DB validation

### Example Service: RealWorld API
```typescript
// src/api/services/realWorld/realWorldEndpoints.ts

export class realWorldService extends BaseService {
  protected basePath: string;

  constructor(apiClient: ApiClient, basePath: string) {
    super(apiClient);
    this.basePath = basePath;
  }

  // User Registration
  async registerUser(payload: object): Promise<APIResponse> {
    return this.callApi({
      method: "POST",
      path_param: "users",
      payload: payload
    });
  }

  // User Login
  async loginUser(payload: object): Promise<APIResponse> {
    return this.callApi({
      method: "POST",
      path_param: "users/login",
      payload: payload
    });
  }

  // Get Articles (with filters)
  async getArticles(filters?: {
    tag?: string;
    author?: string;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse> {
    return this.callApi({
      method: "GET",
      path_param: "articles",
      query_params: filters
    });
  }

  // External API: JSONPlaceholder
  async getExternalUser(userId: number): Promise<APIResponse> {
    return this.callDirectApi({
      url: `https://jsonplaceholder.typicode.com/users/${userId}`,
      method: "GET"
    });
  }

  // External API: GitHub
  async searchGitHubRepos(query: string): Promise<APIResponse> {
    return this.callDirectApi({
      url: "https://api.github.com/search/repositories",
      method: "GET",
      query_params: { q: query, sort: "stars" },
      headers: { "Accept": "application/vnd.github.v3+json" }
    });
  }
}
```

---

## Response Validation

### 1. Status Code Validation
```typescript
await rwService.assertStatus(response, 200);
await rwService.assertStatus(response, 201);
await rwService.assertStatus(response, 404);
```

### 2. Field Validation

**Simple field**:
```typescript
await rwService.validateField(response, "message", "success");
```

**Nested field** (dot notation):
```typescript
await rwService.validateField(response, "user.email", "test@example.com");
await rwService.validateField(response, "data.items[0].id", "12345");
await rwService.validateField(response, "result.user.profile.name", "John Doe");
```

### 3. JSON Schema Validation (AJV)

**Define schema**:
```typescript
// tests/schemas.ts

export const userSchema = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        token: { type: "string" },
        username: { type: "string" },
        bio: { type: ["string", "null"] },
        image: { type: ["string", "null"] }
      },
      required: ["email", "token", "username"]
    }
  },
  required: ["user"]
};
```

**Use in test**:
```typescript
await rwService.validateSchema(response, userSchema);
```

### 4. Zod Schema Validation

**Define schema**:
```typescript
// tests/schemas.ts

import { z } from "zod";

export const userSchemaZod = z.object({
  user: z.object({
    email: z.string().email(),
    token: z.string(),
    username: z.string(),
    bio: z.string().nullable(),
    image: z.string().url().nullable()
  })
});
```

**Use in test**:
```typescript
await rwService.validateZodSchema(response, userSchemaZod);
```

### Validation Comparison

| Feature | JSON Schema (AJV) | Zod |
|---------|-------------------|-----|
| **Type Safety** | ❌ No TypeScript integration | ✅ Full TypeScript types |
| **Runtime Validation** | ✅ Yes | ✅ Yes |
| **Error Messages** | ⚠️ Basic | ✅ Detailed, formatted |
| **Complex Validations** | ✅ Extensive | ✅ Chainable methods |
| **Learning Curve** | ⚠️ Moderate | ✅ Easy |
| **Recommended For** | Legacy schemas | New tests |

---

## Database Validation

### Setup

**Enable in config**:
```env
# .env.stage
DB_ENABLED=true
PG_DB_HOST=localhost
PG_DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret
PG_DB_NAME=testdb
```

### Query Database
```typescript
test("Verify user in database", async ({ rwService }) => {
  // Create user via API
  const payload = BaseTest.generator.registerUser();
  const response = await rwService.registerUser(payload);
  
  const { email } = (await response.json()).user;

  // Query database
  const dbResults = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  // Validate
  expect(dbResults.length).toBe(1);
  expect(dbResults[0].email).toBe(email);
  expect(dbResults[0].username).toBe(payload.user.username);
});
```

### Database Validation Methods

**Schema validation**:
```typescript
const dbResults = await BaseTest.dbClient.query('postgres', sql, params);

await rwService.assertDbQueryResult(dbResults, {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "number" },
      email: { type: "string" }
    }
  }
});
```

**Field validation**:
```typescript
await rwService.assertDbQueryResult(dbResults, "email", "test@example.com");
await rwService.assertDbQueryResult(dbResults, "status", "active");
```

### MySQL Support
```typescript
const mysqlResults = await BaseTest.dbClient.query(
  'mysql',
  'SELECT * FROM users WHERE email = ?',
  [email]
);
```

See [Database Guide](./DATABASE.md) for SSH tunneling and advanced features.

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

// Use descriptive test names
test("User registration returns 201 with valid email and token", async ({ rwService }) => {
  // ...
});

// Validate multiple aspects
await rwService.assertStatus(response, 201);
await rwService.validateZodSchema(response, userSchema);
await rwService.validateField(response, "user.email", payload.user.email);

// Clean test data
const { email } = (await response.json()).user;
// Store for cleanup in afterAll
```

### ❌ DON'T
```typescript
// Don't use both callApi and callDirectApi for same endpoint
const response1 = await apiClient.callApi({ path_param: "/users", method: "GET" });
const response2 = await apiClient.callDirectApi({ url: "https://api.example.com/api/users", method: "GET" });
// ❌ Pick one approach

// Don't hardcode data
const response = await rwService.registerUser({
  user: { email: "test@test.com", password: "password" }
});
// ❌ Use generator instead

// Don't skip validation
const response = await rwService.loginUser(payload);
// ❌ Always validate response

// Don't validate response body twice
const body = await response.json();
const body2 = await response.json();  // ❌ Error: body already consumed
// ✅ Store body in variable
```

---

## Examples

### Example 1: Complete User Flow
```typescript
test.describe("User Registration and Login Flow", () => {
  let userEmail: string;
  let userToken: string;

  test("Register new user", async ({ rwService }) => {
    // Generate data
    const payload = BaseTest.generator.registerUser();
    
    // Call API
    const response = await rwService.registerUser(payload);
    
    // Validate status
    await rwService.assertStatus(response, 201);
    
    // Validate schema
    await rwService.validateZodSchema(response, registerUserSchemaZod);
    
    // Extract data for next test
    const body = await response.json();
    userEmail = body.user.email;
    userToken = body.user.token;
    
    // Verify in database
    const dbResults = await BaseTest.dbClient.query(
      'postgres',
      'SELECT * FROM users WHERE email = $1',
      [userEmail]
    );
    
    expect(dbResults.length).toBe(1);
    expect(dbResults[0].email).toBe(userEmail);
  });

  test("Login with registered user", async ({ rwService }) => {
    const payload = BaseTest.generator.loginUser(userEmail, "password");
    
    const response = await rwService.loginUser(payload);
    
    await rwService.assertStatus(response, 200);
    await rwService.validateField(response, "user.email", userEmail);
    await rwService.validateField(response, "user.token", userToken);
  });
});
```

### Example 2: External API Integration
```typescript
test.describe("External API Tests", () => {
  
  test("Get user from JSONPlaceholder", async ({ rwService }) => {
    const response = await rwService.getExternalUser(1);
    
    await rwService.assertStatus(response, 200);
    await rwService.validateField(response, "id", 1);
    await rwService.validateField(response, "name", "Leanne Graham");
    
    const body = await response.json();
    BaseTest.logger.info(`External user: ${body.name}`);
  });

  test("Search GitHub repositories", async ({ rwService }) => {
    const response = await rwService.searchGitHubRepos("playwright");
    
    await rwService.assertStatus(response, 200);
    
    const body = await response.json();
    expect(body.total_count).toBeGreaterThan(0);
    expect(body.items).toBeInstanceOf(Array);
    
    BaseTest.logger.info(`Found ${body.total_count} repositories`);
  });
});
```

### Example 3: Data-Driven Testing
```typescript
const testUsers = [
  { username: "user1", email: "user1@test.com" },
  { username: "user2", email: "user2@test.com" },
  { username: "user3", email: "user3@test.com" }
];

testUsers.forEach(({ username, email }) => {
  test(`Register user: ${username}`, async ({ rwService }) => {
    const payload = {
      user: { username, email, password: "password" }
    };
    
    const response = await rwService.registerUser(payload);
    
    await rwService.assertStatus(response, 201);
    await rwService.validateField(response, "user.email", email);
  });
});
```

### Example 4: Error Handling
```typescript
test("Handle API errors gracefully", async ({ rwService }) => {
  const invalidPayload = {
    user: { email: "invalid-email", password: "123" }  // Invalid email
  };
  
  const response = await rwService.registerUser(invalidPayload);
  
  // Validate error response
  await rwService.assertStatus(response, 422);
  await rwService.validateField(response, "errors.email", "is invalid");
  
  const body = await response.json();
  BaseTest.logger.warn(`Validation error: ${JSON.stringify(body.errors)}`);
});
```

### Example 5: Authentication Flow
```typescript
test.describe("Authenticated Requests", () => {
  let authToken: string;

  test.beforeAll(async ({ rwService }) => {
    // Login once before all tests
    const loginPayload = BaseTest.generator.loginUser("test@test.com", "password");
    const response = await rwService.loginUser(loginPayload);
    
    const body = await response.json();
    authToken = body.user.token;
  });

  test("Create article with auth", async ({ apiClient }) => {
    const response = await apiClient.callApi({
      path_param: "/articles",
      method: "POST",
      headers: { "Authorization": `Token ${authToken}` },
      payload: {
        article: {
          title: "Test Article",
          description: "Test",
          body: "Content",
          tagList: ["test"]
        }
      }
    });
    
    await expect(response.status()).toBe(201);
  });
});
```

---

## Troubleshooting

### Issue: "Cannot read property 'json' of undefined"

**Cause**: Response body already consumed

**Solution**:
```typescript
// ❌ Wrong
const body1 = await response.json();
const body2 = await response.json();  // Error

// ✅ Correct
const body = await response.json();
// Use 'body' variable multiple times
```

### Issue: Validation fails but response looks correct

**Cause**: Schema mismatch or wrong field path

**Solution**:
```typescript
// Debug the response
const body = await response.json();
BaseTest.logger.debug(`Response: ${JSON.stringify(body, null, 2)}`);

// Check field path
await rwService.validateField(response, "user.email", email);  // Check nesting
```

### Issue: Database query returns empty

**Cause**: Database not enabled or SSH tunnel issue

**Solution**:
```env
# Check .env.stage
DB_ENABLED=true
USE_SSH=false  # Or true if using SSH
```

---

## Summary

| Feature | Usage | Location |
|---------|-------|----------|
| **API Client** | `callApi()`, `callDirectApi()` | `src/api/client.ts` |
| **Service Layer** | Endpoint methods | `src/api/services/` |
| **Validation** | `assertStatus()`, `validateSchema()` | `src/api/services/baseService.ts` |
| **Data Generation** | `BaseTest.generator.*` | `src/api/apiUtils/payloadGenerator.ts` |
| **Database** | `BaseTest.dbClient.query()` | `src/sharedUtils/dbClient.ts` |
| **Logging** | `BaseTest.logger.*` | `src/sharedUtils/logger.ts` |

---

[← Back to Main README](../README.md) | [Next: UI Testing →](./UI_TESTING.md)