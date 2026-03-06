# Utilities Reference

Complete reference for all utility classes and helper functions.

---

## Table of Contents

- [Logger](#logger)
- [Data Generator](#data-generator)
- [Validator](#validator)
- [Payload Generator](#payload-generator)
- [Helper Actions](#helper-actions)

---

## Logger

Winston-based logger with file rotation and multiple log levels.

### Location
```
src/sharedUtils/logger.ts
```

### Features

- Console output (colored, info level)
- File output (debug level)
- Separate log per test run
- Master log file (all runs)
- Timestamped entries
- Multiple log levels

### Log Files
```
logs/
├── test-run-2025-01-15-14-30-45.log  # Current run
└── master.log                        # All runs (append)
```

### Usage
```typescript
import { BaseTest } from "../../BaseApiTest.js";

// Info level (console + file)
BaseTest.logger.info("Test started");
BaseTest.logger.info(`User created: ${email}`);

// Debug level (file only)
BaseTest.logger.debug("Detailed information");
BaseTest.logger.debug(`Response: ${JSON.stringify(body, null, 2)}`);

// Warning level
BaseTest.logger.warn("Non-critical issue detected");

// Error level
BaseTest.logger.error("Test failed with error");
BaseTest.logger.error(`Error details: ${error.message}`);
```

### Log Levels

| Level | Console | File | Use Case |
|-------|---------|------|----------|
| `error` | Yes | Yes | Errors, failures |
| `warn` | Yes | Yes | Warnings, deprecations |
| `info` | Yes | Yes | Important events |
| `debug` | No | Yes | Detailed debugging |

### Configuration
```typescript
// src/sharedUtils/logger.ts

export const logger = createLogger({
  level: 'debug',                    // Minimum level to log
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.Console({
      level: 'info',                 // Console shows info and above
      format: combine(colorize(), timestamp(), logFormat)
    }),
    new transports.File({ 
      filename: runLogFile,          // Current run log
      level: 'debug' 
    }),
    new transports.File({ 
      filename: masterLogFile,       // Master log (append)
      level: 'debug',
      options: { flags: 'a' }
    })
  ]
});
```

### Advanced Usage

**Structured logging:**
```typescript
BaseTest.logger.info('User registration', {
  email: user.email,
  timestamp: Date.now(),
  testId: 'TC_001'
});
```

**Conditional logging:**
```typescript
if (BaseTest.config.logLevel === 'debug') {
  BaseTest.logger.debug(`Full response: ${JSON.stringify(response)}`);
}
```

**Log file location:**
```typescript
import { runLogFile, masterLogFile } from "../src/sharedUtils/logger.js";

console.log(`Current log: ${runLogFile}`);
console.log(`Master log: ${masterLogFile}`);
```

---

## Data Generator

Faker.js wrapper for generating realistic test data.

### Location
```
src/sharedUtils/dataGenerator.ts
```

### Available Methods

#### String Generation
```typescript
import { DynamicDataGenerator } from "../../src/sharedUtils/dataGenerator.js";

// Replace symbols with random characters
const random = DynamicDataGenerator.replaceSymbols("?????");
// Output: "aB3xZ"

const userId = DynamicDataGenerator.replaceSymbols("USER-??????");
// Output: "USER-k9PmN2"

// Generate random word
const word = DynamicDataGenerator.word();
// Output: "banana"

// Generate random sentence
const sentence = DynamicDataGenerator.sentence();
// Output: "The quick brown fox jumps over the lazy dog."

// Generate random paragraph
const paragraph = DynamicDataGenerator.paragraph();
// Output: "Lorem ipsum dolor sit amet..."
```

#### Number Generation
```typescript
// Random integer
const num = DynamicDataGenerator.integer(1, 100);
// Output: 42

const id = DynamicDataGenerator.integer();
// Output: 573 (0-1000 default)

// Random float
const price = DynamicDataGenerator.float(10, 100, 2);
// Output: 45.67 (2 decimal places)

// Random number (int or float)
const value = DynamicDataGenerator.number(0, 50);
// Output: 23
```

#### Date/Time Generation
```typescript
// UTC time after X minutes
const futureTime = DynamicDataGenerator.utcNow_minutesInterval(30);
// Output: "2025-01-15T15:30:00.000Z" (30 mins from now)

// UTC time after X hours
const laterTime = DynamicDataGenerator.utcNow_hourInterval(2);
// Output: "2025-01-15T17:00:00.000Z" (2 hours from now)

// Local time after X minutes
const localFuture = DynamicDataGenerator.localNow_minutesInterval(15);
// Output: "1/15/2025, 3:15:00 PM"

// Local time after X hours
const localLater = DynamicDataGenerator.localNow_hourInterval(1);
// Output: "1/15/2025, 4:00:00 PM"
```

#### UUID Generation
```typescript
// Generate UUID v4
const uuid = DynamicDataGenerator.uuid();
// Output: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

### Usage in Tests
```typescript
test("Generate dynamic data", async () => {
  const userId = DynamicDataGenerator.replaceSymbols("USER-??????");
  const amount = DynamicDataGenerator.float(100, 1000, 2);
  const description = DynamicDataGenerator.sentence();
  
  const payload = {
    userId: userId,
    amount: amount,
    description: description
  };
  
  BaseTest.logger.info(`Generated payload: ${JSON.stringify(payload)}`);
});
```

---

## Validator

Static utility class for response validation using AJV and Zod.

### Location
```
src/api/validator.ts
```

### Methods

#### 1. validateSchema (AJV)

**JSON Schema validation using AJV**
```typescript
static validateSchema(schema: object, responseBody: unknown): boolean
```

**Usage:**
```typescript
const schema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    id: { type: "number" }
  },
  required: ["email", "id"]
};

const body = await response.json();
const isValid = BaseTest.validator.validateSchema(schema, body);

expect(isValid).toBe(true);
```

**Error Handling:**
```typescript
const isValid = BaseTest.validator.validateSchema(schema, body);

if (!isValid) {
  // Errors logged automatically
  // Check logs for details
}
```

#### 2. validateZodSchema

**Zod schema validation with TypeScript integration**
```typescript
static validateZodSchema(schema: z.ZodTypeAny, responseBody: unknown): boolean
```

**Usage:**
```typescript
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  id: z.number().positive()
});

const body = await response.json();
const isValid = BaseTest.validator.validateZodSchema(userSchema, body);

expect(isValid).toBe(true);
```

**Advanced Zod Schemas:**
```typescript
// Optional fields
const schema = z.object({
  email: z.string().email(),
  bio: z.string().nullable(),
  age: z.number().optional()
});

// Arrays
const arraySchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string()
  }))
});

// Nested objects
const nestedSchema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string(),
      age: z.number()
    })
  })
});
```

#### 3. validateFieldValue

**Simple field validation (shallow)**
```typescript
static validateFieldValue(responseBody: any, field: string, expectedValue: unknown): boolean
```

**Usage:**
```typescript
const body = await response.json();

// Top-level field
const isValid = BaseTest.validator.validateFieldValue(body, "status", "success");
expect(isValid).toBe(true);

// Not for nested fields - use validateNestedFieldValue instead
```

#### 4. validateNestedFieldValue

**Nested field validation with dot notation**
```typescript
static validateNestedFieldValue(responseBody: any, fieldPath: string, expectedValue: unknown): boolean
```

**Usage:**
```typescript
const body = await response.json();

// Simple nested field
BaseTest.validator.validateNestedFieldValue(body, "user.email", "test@example.com");

// Array index
BaseTest.validator.validateNestedFieldValue(body, "items[0].id", 123);

// Deep nesting
BaseTest.validator.validateNestedFieldValue(body, "data.user.profile.address.city", "New York");

// Mixed
BaseTest.validator.validateNestedFieldValue(body, "users[0].addresses[1].zipCode", "10001");
```

**Supported Notation:**
```typescript
// Dot notation
"user.email"
"data.items.name"

// Bracket notation
"items[0]"
"users[2]"

// Mixed
"data.items[0].user.profile.name"
"response.results[3].meta.tags[1]"
```

#### 5. getNestedValue

**Helper to retrieve nested values**
```typescript
static getNestedValue(obj: any, path: string): any
```

**Usage:**
```typescript
const body = {
  data: {
    user: {
      profile: {
        name: "John Doe"
      }
    }
  }
};

const name = BaseTest.validator.getNestedValue(body, "data.user.profile.name");
console.log(name); // "John Doe"

const value = BaseTest.validator.getNestedValue(body, "data.items[0].id");
```

### Comparison: AJV vs Zod

| Feature | AJV | Zod |
|---------|-----|-----|
| **Type Safety** | No | Yes |
| **Runtime Validation** | Yes | Yes |
| **Error Messages** | Basic | Detailed |
| **Learning Curve** | Moderate | Easy |
| **Performance** | Fast | Fast |
| **TypeScript Integration** | No | Full |
| **Recommended For** | Legacy schemas | New tests |

---

## Payload Generator

Static class for generating test payloads.

### Location
```
src/api/apiUtils/payloadGenerator.ts
```

### Methods

#### registerUser
```typescript
static registerUser(): object
```

**Returns:**
```typescript
{
  user: {
    username: "testuser???????",
    email: "tester???????@gmail.com",
    password: "password"
  }
}
```

**Usage:**
```typescript
const payload = BaseTest.generator.registerUser();
const response = await rwService.registerUser(payload);
```

#### loginUser
```typescript
static loginUser(email: string, password: string): object
```

**Returns:**
```typescript
{
  user: {
    email: "test@example.com",
    password: "password"
  }
}
```

**Usage:**
```typescript
const email = "test@example.com";
const password = "password123";

const payload = BaseTest.generator.loginUser(email, password);
const response = await rwService.loginUser(payload);
```

### Creating Custom Generators
```typescript
// src/api/apiUtils/payloadGenerator.ts

export class DataGenerator {
  
  // Existing methods...
  
  // Add new generator
  static createArticle(title?: string, description?: string): object {
    return {
      article: {
        title: title || `Article ${DynamicDataGenerator.replaceSymbols("?????")}`,
        description: description || DynamicDataGenerator.sentence(),
        body: DynamicDataGenerator.paragraph(),
        tagList: [
          DynamicDataGenerator.word(),
          DynamicDataGenerator.word()
        ]
      }
    };
  }
  
  static updateProfile(bio?: string, image?: string): object {
    return {
      user: {
        bio: bio || DynamicDataGenerator.sentence(),
        image: image || `https://example.com/avatar/${DynamicDataGenerator.uuid()}.jpg`
      }
    };
  }
}
```

**Usage:**
```typescript
// Use custom generators
const articlePayload = BaseTest.generator.createArticle();
const profilePayload = BaseTest.generator.updateProfile("My bio");
```

---

## Helper Actions

UI testing utilities for network interception, file uploads, and more.

### Location
```
src/ui/actions/helperActions.ts
```

### Initialization
```typescript
import { HelperActions } from '../../../src/ui/actions/helperActions.js';

const page = poManager.getCreateQuestPage().page;
const context = poManager.getCreateQuestPage().context;
const helpers = new HelperActions(page, context);
```

### Methods

#### Network Interception

**interceptRequests**
```typescript
async interceptRequests(url: string | RegExp, handler: RouteHandler): Promise<void>
```

**Usage:**
```typescript
await helpers.interceptRequests('**/api/users', async (route) => {
  await helpers.fulfillRoute(route, { success: true });
});
```

**fulfillRoute**
```typescript
async fulfillRoute(route: Route, body: any, status?: number, contentType?: string): Promise<void>
```

**Usage:**
```typescript
await helpers.fulfillRoute(route, { data: "mocked" }, 200, 'application/json');
```

**continueRoute**
```typescript
async continueRoute(route: Route): Promise<void>
```

**abortRoute**
```typescript
async abortRoute(route: Route): Promise<void>
```

**waitForResponse**
```typescript
async waitForResponse(url: string | RegExp): Promise<Response>
```

**Usage:**
```typescript
const responsePromise = helpers.waitForResponse('**/api/submit');
await page.click('#submit-button');
const response = await responsePromise;

console.log(response.status());
```

**waitForRequest**
```typescript
async waitForRequest(url: string | RegExp): Promise<Request>
```

**onResponse**
```typescript
onResponse(callback: (response: Response) => void): void
```

**Usage:**
```typescript
helpers.onResponse((response) => {
  console.log(`${response.status()} ${response.url()}`);
});
```

**unroute**
```typescript
async unroute(url: string | RegExp): Promise<void>
```

#### File Operations

**uploadFile**
```typescript
async uploadFile(selector: string, filePath: string): Promise<void>
```

**Usage:**
```typescript
await helpers.uploadFile('input[type="file"]', './test-files/document.pdf');
```

**takeScreenshot**
```typescript
async takeScreenshot(path: string): Promise<void>
```

**Usage:**
```typescript
await helpers.takeScreenshot('./screenshots/failure.png');
```

#### Dialog Handling

**takeDialogAction**
```typescript
async takeDialogAction(action: 'accept' | 'dismiss'): Promise<void>
```

**Usage:**
```typescript
// Setup before dialog appears
await helpers.takeDialogAction('accept');

// Trigger action that shows dialog
await page.click('.delete-button');

// Dialog will be accepted automatically
```

### Advanced Examples

**Mock multiple endpoints:**
```typescript
// Mock success response
await helpers.interceptRequests('**/api/users', async (route) => {
  await helpers.fulfillRoute(route, { 
    users: [{ id: 1, name: "Test User" }] 
  });
});

// Mock error response
await helpers.interceptRequests('**/api/error', async (route) => {
  await helpers.fulfillRoute(route, { 
    error: "Not found" 
  }, 404);
});
```

**Modify requests:**
```typescript
await helpers.interceptRequests('**/api/**', async (route) => {
  const request = route.request();
  const headers = request.headers();
  headers['X-Custom-Header'] = 'test-value';
  
  await route.continue({ headers });
});
```

**Block requests:**
```typescript
// Block analytics
await helpers.interceptRequests('**/analytics/**', async (route) => {
  await helpers.abortRoute(route);
});

// Block ads
await helpers.interceptRequests('**/ads/**', async (route) => {
  await helpers.abortRoute(route);
});
```

**Monitor network:**
```typescript
const requests: string[] = [];

page.on('request', request => {
  requests.push(request.url());
});

helpers.onResponse(response => {
  console.log(`Response: ${response.status()} ${response.url()}`);
});

// Perform actions...

console.log(`Total requests: ${requests.length}`);
```

---

## Summary

| Utility | Purpose | Access Via |
|---------|---------|------------|
| **Logger** | Logging to console/file | `BaseTest.logger` |
| **DataGenerator** | Generate random data | `DynamicDataGenerator.*` |
| **Validator** | Validate responses | `BaseTest.validator` |
| **PayloadGenerator** | Generate API payloads | `BaseTest.generator` |
| **HelperActions** | Network/file utilities | `new HelperActions(page, context)` |

---

[Back to Main README](../README.md) | [Next: Examples](./EXAMPLES.md)