<!-- docs/STEP_DECORATOR_GUIDE.md -->

# Step Decorator Guide

## Overview

The `@step()` decorator automatically wraps your test methods with `test.step()` for better test reporting and tracking. It integrates seamlessly with Playwright's HTML reporter and automatically shows class ownership in reports.

## Installation

### Option 1: Import from BasePage (Recommended)
```typescript
import { BasePage, step } from './basePage.js';
```

### Option 2: Direct Import
```typescript
import { step } from '../../sharedUtils/stepDecorator.js';
```

BasePage re-exports the decorator for convenience, so you only need one import line.

## Basic Usage

### Pattern 1: No Message (Default)

Uses the class and method name as the step name.

```typescript
import { BasePage, step } from './basePage.js';

export class LoginPage extends BasePage {
  @step()
  async fillUsername(username: string) {
    await this.fill(this.page.locator('input[name="username"]'), username);
  }

  @step()
  async clickSubmit() {
    await this.click(this.page.locator('button[type="submit"]'));
  }
}
```

**Report Output:**
```
✓ LoginPage.fillUsername
✓ LoginPage.clickSubmit
```

---

### Pattern 2: Static Message

Provides a custom, descriptive message with class.method context.

```typescript
export class LoginPage extends BasePage {
  @step('Entering username field')
  async fillUsername(username: string) {
    await this.fill(this.page.locator('input[name="username"]'), username);
  }

  @step('Clicking login button')
  async clickSubmit() {
    await this.click(this.page.locator('button[type="submit"]'));
  }
}
```

**Report Output:**
```
✓ Entering username field • [LoginPage.fillUsername]
✓ Clicking login button • [LoginPage.clickSubmit]
```

---

### Pattern 3: Parameter Interpolation

Uses `{{paramName}}` to include actual parameter values in the step name with class context.

```typescript
export class LoginPage extends BasePage {
  @step('Logging in as {{username}}')
  async login(username: string, password: string) {
    await this.fillUsername(username);
    await this.fill(this.page.locator('input[name="password"]'), password);
    await this.click(this.page.locator('button[type="submit"]'));
  }
}
```

**Test Code:**
```typescript
test('login test', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('john_doe', 'secret123');
});
```

**Report Output:**
```
✓ login test (1.2s)
  ✓ Logging in as john_doe • [LoginPage.login]
    ✓ LoginPage.fillUsername
    ✓ LoginPage.fill
    ✓ LoginPage.click
```

---

## Advanced Usage

### Multiple Parameter Interpolation

```typescript
export class SignupPage extends BasePage {
  @step('Filling signup form - Username: {{username}}, Email: {{email}}')
  async fillSignupForm(username: string, email: string, password: string) {
    await this.fill(this.page.locator('input[name="username"]'), username);
    await this.fill(this.page.locator('input[name="email"]'), email);
    await this.fill(this.page.locator('input[name="password"]'), password);
  }
}
```

**Test Code:**
```typescript
test('signup test', async ({ page }) => {
  const signupPage = new SignupPage(page);
  await signupPage.fillSignupForm('alice', 'alice@test.com', 'pass123');
});
```

**Report Output:**
```
✓ signup test
  ✓ Filling signup form - Username: alice, Email: alice@test.com • [SignupPage.fillSignupForm]
```

---

### Object Parameter Interpolation

Objects are automatically JSON stringified.

```typescript
export class UserService extends BaseService {
  @step('Creating user: {{userData}}')
  async createUser(userData: { name: string; email: string; age: number }) {
    return await this.callApi({
      method: 'POST',
      path: '/users',
      data: userData
    });
  }
}
```

**Test Code:**
```typescript
test('create user test', async ({ apiClient }) => {
  const userService = new UserService(apiClient, '/api');
  await userService.createUser({
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  });
});
```

**Report Output:**
```
✓ create user test
  ✓ Creating user: {"name":"John Doe","email":"john@example.com","age":30} • [UserService.createUser]
```

---

### Nested Steps (Automatic)

When decorated methods call other decorated methods, they automatically nest. The class context is shown for each level.

```typescript
export class LoginPage extends BasePage {
  @step('Filling username')
  async fillUsername(username: string) {
    await this.fill(this.page.locator('input[name="username"]'), username);
  }

  @step('Entering password')
  async fillPassword(password: string) {
    await this.fill(this.page.locator('input[name="password"]'), password);
  }

  @step('Logging in as {{username}}')
  async login(username: string, password: string) {
    await this.fillUsername(username);  // Nests under parent step
    await this.fillPassword(password);  // Nests under parent step
    await this.click(this.page.locator('button[type="submit"]'));
  }
}
```

**Report Output:**
```
✓ Logging in as john_doe • [LoginPage.login]
  ✓ Filling username • [LoginPage.fillUsername]
  ✓ Entering password • [LoginPage.fillPassword]
  ✓ LoginPage.click
```

---

## Usage Patterns

### Pattern 1: Page Objects (UI Testing)

```typescript
import { BasePage, step } from './basePage.js';

export class CheckoutPage extends BasePage {
  @step('Adding item {{itemId}} to cart')
  async addToCart(itemId: number, quantity: number = 1) {
    // Implementation
  }

  @step('Entering shipping address')
  async enterShippingAddress(address: string) {
    // Implementation
  }

  @step('Completing checkout for {{email}}')
  async completeCheckout(email: string, cardToken: string) {
    // Implementation
  }
}
```

### Pattern 2: API Services

```typescript
import { BaseService, step } from '../../api/services/baseService.js';

export class ProductService extends BaseService {
  @step('Fetching products with filter: {{filter}}')
  async getProducts(filter: string) {
    return await this.callApi({
      method: 'GET',
      path: `/products?filter=${filter}`
    });
  }

  @step('Creating product: {{name}}')
  async createProduct(name: string, price: number) {
    return await this.callApi({
      method: 'POST',
      path: '/products',
      data: { name, price }
    });
  }
}
```

### Pattern 3: Validation Helpers

```typescript
import { BaseService, step } from '../../api/services/baseService.js';

export class ValidationHelper extends BaseService {
  @step('Verifying user {{userId}} has email {{email}}')
  async verifyUserEmail(userId: number, email: string) {
    // Implementation
  }

  @step('Asserting response status is {{expectedStatus}}')
  async assertStatus(response: any, expectedStatus: number) {
    // Implementation
  }
}
```

---

## Spec File Usage

### UI Test Example

```typescript
import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../pages/checkoutPage.js';
import { ProductService } from '../services/productService.js';

test('Complete ecommerce flow', async ({ page, apiClient }) => {
  const checkout = new CheckoutPage(page);
  const products = new ProductService(apiClient, '/api');

  // Steps appear with class context and parameter values
  await checkout.addToCart(123, 2);
  
  const allProducts = await products.getProducts('electronics');
  expect(allProducts).toHaveLength(5);

  await checkout.enterShippingAddress('123 Main St');
  
  const createdProduct = await products.createProduct('New Item', 29.99);
  expect(createdProduct.id).toBeDefined();

  await checkout.completeCheckout('john@example.com', 'tok_123');
});

// HTML Report will show:
// ✓ Complete ecommerce flow (2.5s)
//   ✓ Adding item 123 to cart • [CheckoutPage.addToCart]
//   ✓ Fetching products with filter: electronics • [ProductService.getProducts]
//   ✓ Entering shipping address • [CheckoutPage.enterShippingAddress]
//   ✓ Creating product: New Item • [ProductService.createProduct]
//   ✓ Completing checkout for john@example.com • [CheckoutPage.completeCheckout]
```

### API Test Example

The step decorator works seamlessly with API tests. Add `@step()` decorators to your API service methods:

```typescript
// services/questService.ts
import { BaseService, step } from './baseService.js';

export class QuestService extends BaseService {
  @step('Creating quest: {{questData}}')
  async createQuest(questData: { title: string; description: string; points: number }) {
    return await this.callApi({
      method: 'POST',
      path: '/quests',
      data: questData
    });
  }

}
```

### Real Example: SignupRealWorld

```typescript
import { test, expect } from '@playwright/test';
import { SignupRealWorld } from '../pages/signupRealWorld.js';

test('complete signup workflow', async ({ page }) => {
  const signup = new SignupRealWorld(page);
  
  await signup.clickSignupButton();
  await signup.verifySignupPage();
  await signup.fillForm('john_doe', 'john@example.com', 'Test@12345');
  
  const isEnabled = await signup.isSubmitBtnDisabled();
  expect(isEnabled).toBe(false);
  
  await signup.clickSubmitBtn();
  
  const loggedIn = await signup.isLoggedIn();
  expect(loggedIn).toBe(true);
});

// HTML Report will show:
// ✓ complete signup workflow (2.1s)
//   ✓ SignupRealWorld.clickSignupButton • [clicking signup button]
//   ✓ SignupRealWorld.verifySignupPage • [Verifying signup page is displayed]
//   ✓ SignupRealWorld.fillForm • [Filling signup form with username: john_doe, email: john@example.com]
//   ✓ SignupRealWorld.isSubmitBtnDisabled • [Checking if submit button is disabled before fill form]
//   ✓ SignupRealWorld.clickSubmitBtn
//   ✓ SignupRealWorld.isLoggedIn
```

---

## Step Name Format

The decorator generates step names in this format:

### With Custom Message:
```
Custom Message • [ClassName.methodName]
```

Example:
```
Logging in as john_doe • [LoginPage.login]
Filling form with username: alice, email: alice@test.com • [SignupPage.fillForm]
```

### Without Custom Message:
```
ClassName.methodName
```

Example:
```
LoginPage.fillUsername
CheckoutPage.addToCart
ProductService.getProducts
```

This format ensures:
- ✅ Clear action/message is always visible
- ✅ Class ownership is always shown in brackets
- ✅ Easy to trace where each step comes from
- ✅ Professional, consistent report structure

---

## Tips & Best Practices

### ✅ Do's

1. **Use descriptive messages:**
   ```typescript
   @step('Logging in as {{username}}')  // Good
   async login(username: string) { }
   
   // Instead of:
   @step()  // Less descriptive
   async login(username: string) { }
   ```

2. **Include relevant parameters:**
   ```typescript
   @step('Creating order {{orderId}} with total {{total}}')
   async createOrder(orderId: string, total: number) { }
   ```

3. **Use for logical grouping:**
   ```typescript
   @step('Completing user registration')
   async register(email: string, password: string) {
     // Multiple sub-steps will nest nicely
     await this.fillEmail(email);
     await this.fillPassword(password);
     await this.acceptTerms();
     await this.submit();
   }
   ```

### ❌ Don'ts

1. **Don't use overly long messages:**
   ```typescript
   // ❌ Too long
   @step('Verifying that user with ID {{userId}} has email {{email}} and is active')
   
   // ✅ Better
   @step('Verifying user {{userId}} email: {{email}}')
   ```

2. **Don't use sensitive parameters:**
   ```typescript
   // ❌ Avoid logging passwords/tokens
   @step('Logging in with password: {{password}}')
   
   // ✅ Better
   @step('Logging in as {{username}}')
   ```

3. **Don't duplicate test.step():**
   ```typescript
   // ❌ Don't nest step decorators with explicit test.step()
   @step('My step')
   async myMethod() {
     await test.step('nested', async () => {
       // Redundant
     });
   }
   
   // ✅ Let decorator handle test.step()
   @step('My step')
   async myMethod() {
     // Implementation
   }
   ```

---

## How It Works

The decorator:

1. **Intercepts** the method call
2. **Extracts** the class name and method name
3. **Extracts** parameter names from function signature
4. **Interpolates** `{{paramName}}` with actual values
5. **Formats** the step name: "Message • [ClassName.methodName]"
6. **Wraps** execution in `test.step()`
7. **Returns** the result maintaining type safety

All `async` methods in your page objects and services can be decorated without any changes to their implementation.

---

## Troubleshooting

### Steps not appearing in report

**Problem:** Steps decorated with `@step()` aren't showing in the HTML report.

**Solution:** Make sure you're using the decorator on `async` methods only:
```typescript
@step('My step')
async myMethod() { }  // ✓ Works

@step('My step')
myMethod() { }  // ✗ Won't work (not async)
```

### Parameter interpolation not working

**Problem:** `{{paramName}}` not being replaced with values.

**Solution:** Make sure the parameter name in the message matches the function signature:
```typescript
@step('Processing {{id}}')
async process(userId: number) { }  // ✗ Mismatch: id vs userId

@step('Processing {{userId}}')
async process(userId: number) { }  // ✓ Correct
```

### Class context not showing

**Problem:** Step shows as "message" instead of "message • [ClassName.method]"

**Solution:** This only happens if you're not using the decorator properly. Make sure:
- Method is part of a class
- Class has a `constructor` property (all classes do by default)
- Using `@step('message')` syntax correctly

### Type errors with decorator

**Problem:** TypeScript errors about decorators not being enabled.

**Solution:** Ensure `experimentalDecorators` is enabled in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "target": "ES2022"
  }
}
```

---

## Migration Guide

### From Manual test.step() to @step()

**Before:**
```typescript
export class LoginPage extends BasePage {
  async login(username: string, password: string) {
    return await test.step(`Logging in as ${username}`, async () => {
      await this.fillUsername(username);
      await this.fillPassword(password);
      await this.click('button[type="submit"]');
    });
  }
}
```

**After:**
```typescript
export class LoginPage extends BasePage {
  @step('Logging in as {{username}}')
  async login(username: string, password: string) {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.click('button[type="submit"]');
  }
}
```

**Benefits:**
- ✅ 40% less code
- ✅ Automatic class context in reports
- ✅ Auto-nesting of method calls
- ✅ Much cleaner and more maintainable
- ✅ No need to import test.step

---

## Step Name Examples

### Real Examples from SignupRealWorld

```typescript
// No message
@step()
async clickSignupButton() { }
// Report: SignupRealWorld.clickSignupButton

// Static message
@step('Verifying signup page is displayed')
async verifySignupPage() { }
// Report: Verifying signup page is displayed • [SignupRealWorld.verifySignupPage]

// With parameters
@step('Checking if submit button is disabled before fill form')
async isSubmitBtnDisabled() { }
// Report: Checking if submit button is disabled before fill form • [SignupRealWorld.isSubmitBtnDisabled]

// With interpolation
@step('Filling signup form with username: {{username}}, email: {{email}}')
async fillForm(username: string, email: string, password: string) { }
// Report: Filling signup form with username: john_doe, email: john@example.com • [SignupRealWorld.fillForm]

// Nested example
@step('Completing signup for {{email}}')
async completeSignup(username: string, email: string, password: string) {
  await this.clickSignupButton();
  await this.verifySignupPage();
  await this.fillForm(username, email, password);
  await this.clickSubmitBtn();
}
// Report:
// Completing signup for john@example.com • [SignupRealWorld.completeSignup]
//   ✓ SignupRealWorld.clickSignupButton
//   ✓ SignupRealWorld.verifySignupPage
//   ✓ Filling signup form with username: john_doe, email: john@example.com • [SignupRealWorld.fillForm]
//   ✓ SignupRealWorld.clickSubmitBtn
```
