# Database Testing Guide

Complete guide to database operations and validation in the PlayType framework.

---

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Database Operations](#database-operations)
- [SSH Tunneling](#ssh-tunneling)
- [Validation Patterns](#validation-patterns)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

The framework supports database testing with:

- PostgreSQL and MySQL support
- SSH tunnel for secure remote connections
- Direct connection for local databases
- Query execution with parameterized queries
- Automatic connection lifecycle management
- Database result validation

---

## Setup

### Environment Configuration

**PostgreSQL Configuration:**
```env
# .env.stage

# Enable/disable database testing
DB_ENABLED=true

# PostgreSQL settings
PG_DB_HOST=localhost
PG_DB_PORT=5432
PG_DB_NAME=testdb
DB_USER=postgres
DB_PASSWORD=your-password

# MySQL settings (if needed)
MYS_DB_HOST=localhost
MYS_DB_PORT=3306
MYS_DB_NAME=testdb

# SSH tunnel settings
USE_SSH=false
SSH_HOST=bastion.example.com
SSH_PORT=22
SSH_USER=ubuntu
SSH_KEY_PATH=~/.ssh/id_rsa
```

### Configuration in Code
```typescript
// src/sharedUtils/config.ts

export default {
  db: {
    enabled: process.env.DB_ENABLED === "true",
    ssh: {
      useSsh: process.env.USE_SSH === "true",
      host: process.env.SSH_HOST || "",
      port: Number(process.env.SSH_PORT) || 22,
      username: process.env.SSH_USER || "",
      privateKeyPath: process.env.SSH_KEY_PATH || "",
    },
    pgsql: {
      host: process.env.PG_DB_HOST || "",
      port: Number(process.env.PG_DB_PORT) || 5432,
      user: process.env.DB_USER || "",
      password: process.env.DB_PASSWORD || "",
      name: process.env.PG_DB_NAME || "",
    },
    mysql: {
      host: process.env.MYS_DB_HOST || "",
      port: Number(process.env.MYS_DB_PORT) || 3306,
      user: process.env.DB_USER || "",
      password: process.env.DB_PASSWORD || "",
      name: process.env.MYS_DB_NAME || "",
    },
  }
};
```

---

## Database Operations

### Basic Query Execution

#### PostgreSQL
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";

test("Query PostgreSQL database", async () => {
  const results = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    ['test@example.com']
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results[0].email).toBe('test@example.com');
});
```

#### MySQL
```typescript
test("Query MySQL database", async () => {
  const results = await BaseTest.dbClient.query(
    'mysql',
    'SELECT * FROM users WHERE email = ?',
    ['test@example.com']
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results[0].email).toBe('test@example.com');
});
```

### Query Method Signature
```typescript
static async query<T = any>(
  type: 'postgres' | 'mysql',
  sql: string,
  params: any[] = []
): Promise<T[]>
```

**Parameters:**
- `type`: Database type ('postgres' or 'mysql')
- `sql`: SQL query string with placeholders
- `params`: Array of parameter values

**Returns:**
- Array of query results (typed as T[])

**Placeholders:**
- PostgreSQL: `$1, $2, $3...`
- MySQL: `?, ?, ?...`

---

## SSH Tunneling

### How It Works
```
Your Machine
    |
    | SSH Connection
    v
Bastion Host (SSH Server)
    |
    | Database Connection
    v
Database Server (PostgreSQL/MySQL)
```

### Configuration
```env
USE_SSH=true
SSH_HOST=bastion.example.com
SSH_PORT=22
SSH_USER=ubuntu
SSH_KEY_PATH=~/.ssh/id_rsa
```

### SSH Key Setup

**Generate SSH key (if needed):**
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
```

**Copy to bastion:**
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub ubuntu@bastion.example.com
```

**Test connection:**
```bash
ssh -i ~/.ssh/id_rsa ubuntu@bastion.example.com
```

### Direct Connection vs SSH Tunnel

**Direct Connection** (USE_SSH=false):
```
Your Machine ---> Database Server
```

**SSH Tunnel** (USE_SSH=true):
```
Your Machine ---> SSH Server ---> Database Server
```

### When to Use SSH Tunnel

Use SSH tunneling when:
- Database is behind a firewall
- Database doesn't allow direct external connections
- You need to access production database securely
- Company security policy requires bastion host

Use direct connection when:
- Database is local (localhost)
- Database allows direct connections
- No firewall restrictions

---

## Validation Patterns

### 1. Verify Record Exists
```typescript
test("Verify user created in database", async ({ rwService }) => {
  // Create via API
  const payload = BaseTest.generator.registerUser();
  const response = await rwService.registerUser(payload);
  
  const { email } = (await response.json()).user;

  // Verify in database
  const results = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  expect(results.length).toBe(1);
  expect(results[0].email).toBe(email);
});
```

### 2. Verify Data Integrity
```typescript
test("Verify data matches between API and DB", async ({ rwService }) => {
  // Create via API
  const payload = {
    user: {
      username: "testuser",
      email: "test@example.com",
      password: "password"
    }
  };
  
  const response = await rwService.registerUser(payload);
  const apiUser = (await response.json()).user;

  // Query database
  const dbResults = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [apiUser.email]
  );

  const dbUser = dbResults[0];

  // Verify all fields match
  expect(dbUser.email).toBe(apiUser.email);
  expect(dbUser.username).toBe(apiUser.username);
  expect(dbUser.bio).toBe(apiUser.bio);
  expect(dbUser.image).toBe(apiUser.image);
});
```

### 3. Verify Relationships
```typescript
test("Verify foreign key relationships", async ({ rwService }) => {
  // Create user
  const userPayload = BaseTest.generator.registerUser();
  const userResponse = await rwService.registerUser(userPayload);
  const { email, token } = (await userResponse.json()).user;

  // Create article
  const articlePayload = {
    article: {
      title: "Test Article",
      description: "Test",
      body: "Content"
    }
  };
  
  const articleResponse = await rwService.createArticle(
    articlePayload,
    { "Authorization": `Token ${token}` }
  );
  
  const { slug } = (await articleResponse.json()).article;

  // Verify relationship in database
  const results = await BaseTest.dbClient.query(
    'postgres',
    `SELECT u.email, a.slug, a.title 
     FROM articles a 
     JOIN users u ON a.author_id = u.id 
     WHERE a.slug = $1`,
    [slug]
  );

  expect(results.length).toBe(1);
  expect(results[0].email).toBe(email);
  expect(results[0].slug).toBe(slug);
});
```

### 4. Verify Counts and Aggregations
```typescript
test("Verify article count per user", async ({ rwService }) => {
  const userEmail = "test@example.com";

  // Query article count
  const results = await BaseTest.dbClient.query(
    'postgres',
    `SELECT COUNT(*) as article_count 
     FROM articles a 
     JOIN users u ON a.author_id = u.id 
     WHERE u.email = $1`,
    [userEmail]
  );

  const count = parseInt(results[0].article_count);
  expect(count).toBeGreaterThan(0);
  
  BaseTest.logger.info(`User has ${count} articles`);
});
```

### 5. Verify Timestamps
```typescript
test("Verify created timestamp", async ({ rwService }) => {
  const beforeCreate = new Date();
  
  // Create user
  const payload = BaseTest.generator.registerUser();
  await rwService.registerUser(payload);
  
  const afterCreate = new Date();

  // Query database
  const results = await BaseTest.dbClient.query(
    'postgres',
    'SELECT created_at FROM users WHERE email = $1',
    [payload.user.email]
  );

  const createdAt = new Date(results[0].created_at);
  
  // Verify timestamp is within expected range
  expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
  expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
});
```

### 6. Schema Validation with BaseService
```typescript
test("Validate DB results with schema", async ({ rwService }) => {
  const results = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users LIMIT 5',
    []
  );

  // Define schema
  const userSchema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "number" },
        email: { type: "string" },
        username: { type: "string" },
        created_at: { type: "string" }
      },
      required: ["id", "email", "username"]
    }
  };

  // Validate using service method
  await rwService.assertDbQueryResult(results, userSchema);
});
```

### 7. Field Validation with BaseService
```typescript
test("Validate specific field in DB results", async ({ rwService }) => {
  const email = "test@example.com";
  
  const results = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  // Validate specific field
  await rwService.assertDbQueryResult(results, "email", email);
  await rwService.assertDbQueryResult(results, "status", "active");
});
```

---

## Best Practices

### DO
```typescript
// Use parameterized queries (prevents SQL injection)
const results = await BaseTest.dbClient.query(
  'postgres',
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Close connections automatically (handled by framework)
// No manual connection management needed

// Log query results for debugging
BaseTest.logger.debug(`Query returned ${results.length} rows`);

// Validate data integrity between API and DB
expect(apiResponse.email).toBe(dbResult.email);

// Use transactions for data cleanup (if needed)
await BaseTest.dbClient.query('postgres', 'BEGIN', []);
// ... test operations
await BaseTest.dbClient.query('postgres', 'ROLLBACK', []);
```

### DON'T
```typescript
// Don't use string concatenation (SQL injection risk)
const results = await BaseTest.dbClient.query(
  'postgres',
  `SELECT * FROM users WHERE email = '${email}'`,  // DANGEROUS
  []
);

// Don't leave connections open manually
// Framework handles this automatically

// Don't hardcode database credentials
const password = "hardcoded-password";  // Use .env instead

// Don't query production DB in tests without safeguards
// Use read-only user or separate test database

// Don't ignore empty results
if (results.length === 0) {
  BaseTest.logger.warn('No results found - expected?');
}
```

---

## Examples

### Example 1: End-to-End Data Verification
```typescript
test("Verify complete user registration flow", async ({ rwService }) => {
  // 1. Generate test data
  const payload = BaseTest.generator.registerUser();
  const { username, email, password } = payload.user;

  // 2. Register via API
  const registerResponse = await rwService.registerUser(payload);
  await rwService.assertStatus(registerResponse, 201);
  
  const apiUser = (await registerResponse.json()).user;

  // 3. Verify in database
  const dbResults = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  expect(dbResults.length).toBe(1);
  
  const dbUser = dbResults[0];

  // 4. Compare API response with DB record
  expect(dbUser.email).toBe(apiUser.email);
  expect(dbUser.username).toBe(apiUser.username);
  expect(dbUser.bio).toBe(apiUser.bio);
  
  // 5. Verify password is hashed (not plain text)
  expect(dbUser.password).not.toBe(password);
  expect(dbUser.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt format
  
  // 6. Verify timestamps
  expect(dbUser.created_at).toBeDefined();
  expect(dbUser.updated_at).toBeDefined();
  
  BaseTest.logger.info(`User verified: ${email}`);
});
```

### Example 2: Data Cleanup
```typescript
test.describe("Article Tests with Cleanup", () => {
  const createdArticles: string[] = [];

  test.afterAll(async () => {
    // Clean up created articles
    if (createdArticles.length > 0) {
      const placeholders = createdArticles.map((_, i) => `$${i + 1}`).join(', ');
      
      await BaseTest.dbClient.query(
        'postgres',
        `DELETE FROM articles WHERE slug IN (${placeholders})`,
        createdArticles
      );
      
      BaseTest.logger.info(`Cleaned up ${createdArticles.length} articles`);
    }
  });

  test("Create article", async ({ rwService }) => {
    // Create article
    const response = await rwService.createArticle(payload, headers);
    const { slug } = (await response.json()).article;
    
    createdArticles.push(slug);
    
    // Verify in DB
    const results = await BaseTest.dbClient.query(
      'postgres',
      'SELECT * FROM articles WHERE slug = $1',
      [slug]
    );
    
    expect(results.length).toBe(1);
  });
});
```

### Example 3: Complex Joins
```typescript
test("Verify user's article with tags", async () => {
  const userEmail = "author@example.com";

  const results = await BaseTest.dbClient.query(
    'postgres',
    `SELECT 
       u.email,
       u.username,
       a.slug,
       a.title,
       a.created_at,
       ARRAY_AGG(t.name) as tags
     FROM users u
     JOIN articles a ON a.author_id = u.id
     LEFT JOIN article_tags at ON at.article_id = a.id
     LEFT JOIN tags t ON t.id = at.tag_id
     WHERE u.email = $1
     GROUP BY u.id, a.id
     ORDER BY a.created_at DESC
     LIMIT 10`,
    [userEmail]
  );

  expect(results.length).toBeGreaterThan(0);
  
  results.forEach(row => {
    expect(row.email).toBe(userEmail);
    expect(row.tags).toBeInstanceOf(Array);
    BaseTest.logger.debug(`Article: ${row.title}, Tags: ${row.tags.join(', ')}`);
  });
});
```

### Example 4: Performance Comparison
```typescript
test("Compare API vs direct DB query performance", async ({ rwService }) => {
  const email = "test@example.com";

  // Time API call
  const apiStart = Date.now();
  await rwService.loginUser(BaseTest.generator.loginUser(email, "password"));
  const apiDuration = Date.now() - apiStart;

  // Time DB query
  const dbStart = Date.now();
  await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  const dbDuration = Date.now() - dbStart;

  BaseTest.logger.info(`API call: ${apiDuration}ms, DB query: ${dbDuration}ms`);
  
  // DB should be faster
  expect(dbDuration).toBeLessThan(apiDuration);
});
```

### Example 5: Verify Data Migration
```typescript
test("Verify data migration completed", async () => {
  // Check old table is empty
  const oldResults = await BaseTest.dbClient.query(
    'postgres',
    'SELECT COUNT(*) as count FROM old_users',
    []
  );
  
  expect(parseInt(oldResults[0].count)).toBe(0);

  // Check new table has data
  const newResults = await BaseTest.dbClient.query(
    'postgres',
    'SELECT COUNT(*) as count FROM users',
    []
  );
  
  const newCount = parseInt(newResults[0].count);
  expect(newCount).toBeGreaterThan(0);
  
  BaseTest.logger.info(`Migrated ${newCount} users`);
});
```

---

## Troubleshooting

### Issue: "Connection timeout"

**Cause**: Cannot reach database or SSH host

**Solution:**
```bash
# Test SSH connection
ssh -i ~/.ssh/id_rsa ubuntu@bastion.example.com

# Test database connection (if direct)
psql -h localhost -U postgres -d testdb

# Check firewall rules
# Check security groups (AWS)
```

### Issue: "Authentication failed"

**Cause**: Wrong credentials or SSH key

**Solution:**
```env
# Verify credentials in .env
DB_USER=correct-user
DB_PASSWORD=correct-password

# Verify SSH key path
SSH_KEY_PATH=/Users/you/.ssh/id_rsa

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa
```

### Issue: "Database query returned no results"

**Cause**: DB disabled or data doesn't exist

**Solution:**
```typescript
const results = await BaseTest.dbClient.query('postgres', sql, params);

if (results.length === 0) {
  BaseTest.logger.warn('No results - is DB enabled?');
  BaseTest.logger.debug(`SQL: ${sql}`);
  BaseTest.logger.debug(`Params: ${JSON.stringify(params)}`);
}
```

### Issue: "SSL connection required"

**Cause**: Database requires SSL

**Solution:**
```typescript
// Modify dbClient.ts to add SSL config
const pgClient = new Client({
  host: config.db.pgsql.host,
  port: config.db.pgsql.port,
  user: config.db.pgsql.user,
  password: config.db.pgsql.password,
  database: config.db.pgsql.name,
  ssl: {
    rejectUnauthorized: false  // For development
  }
});
```

---

## Summary

| Feature | Usage | Type |
|---------|-------|------|
| **Query** | `BaseTest.dbClient.query(type, sql, params)` | PostgreSQL/MySQL |
| **SSH Tunnel** | `USE_SSH=true` in .env | Secure connection |
| **Validation** | `rwService.assertDbQueryResult()` | Schema/Field |
| **Cleanup** | Use `test.afterAll()` | Test isolation |

---

[Back to Main README](../README.md) | [Next: Configuration](./CONFIGURATION.md)