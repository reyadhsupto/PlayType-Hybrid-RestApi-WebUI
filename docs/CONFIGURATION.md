# Configuration Guide

Complete guide to environment and configuration management.

---

## Table of Contents

- [Overview](#overview)
- [Environment Files](#environment-files)
- [Configuration Structure](#configuration-structure)
- [Consul Integration](#consul-integration)
- [Multi-Environment Setup](#multi-environment-setup)
- [Best Practices](#best-practices)

---

## Overview

The framework supports multiple configuration sources:

- .env files for different environments (stage, prod)
- Consul for centralized configuration
- Runtime config overrides
- Environment variable fallbacks

---

## Environment Files

### File Structure
```
project/
├── .env.stage        # Stage environment
├── .env.prod         # Production environment
├── .env.local        # Local development (gitignored)
└── .env.example      # Template for new environments
```

### Environment Selection

**Via Makefile:**
```bash
make test ENV=stage      # Uses .env.stage
make test ENV=prod       # Uses .env.prod
make test ENV=local      # Uses .env.local
```

**Via npm:**
```bash
ENV=prod npm test
```

**Default:** stage

---

## Configuration Structure

### Complete .env Template
```env
# ==================================
# API Configuration
# ==================================
api_base_url=https://api.example.com
api_base_path=/api

# ==================================
# UI Configuration
# ==================================
dashboard_url=https://app.example.com
domain=.example.com

# ==================================
# Authentication (UI Tests)
# ==================================
AUTH_KEY=authState
AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
AUTH_USER_EMAIL=test@example.com
AUTH_USER_NAME=Test User
AUTH_GIVEN_NAME=Test
AUTH_FAMILY_NAME=User
AUTH_USER_PIC=https://example.com/avatar.jpg

# ==================================
# Database - PostgreSQL
# ==================================
DB_ENABLED=true
PG_DB_HOST=localhost
PG_DB_PORT=5432
PG_DB_NAME=testdb
DB_USER=postgres
DB_PASSWORD=your-password

# ==================================
# Database - MySQL
# ==================================
MYS_DB_HOST=localhost
MYS_DB_PORT=3306
MYS_DB_NAME=testdb

# ==================================
# SSH Tunnel (Database)
# ==================================
USE_SSH=false
SSH_HOST=bastion.example.com
SSH_PORT=22
SSH_USER=ubuntu
SSH_KEY_PATH=~/.ssh/id_rsa

# ==================================
# Consul (Optional)
# ==================================
CONSUL_ENABLED=false
CONSUL_HOST=127.0.0.1
CONSUL_PORT=8500
CONSUL_PREFIX=ParcelQuest
```

### Config Loading Priority

1. Consul (if enabled)
2. .env.[ENV] file
3. System environment variables
4. Default values in config.ts

---

## Configuration Structure in Code

### Main Config File
```typescript
// src/sharedUtils/config.ts

import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Determine environment
const ENV = process.env.ENV || "stage";

// Load .env file
const envPath = path.resolve(process.cwd(), `.env.${ENV}`);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`Environment file ${envPath} not found.`);
}

const config = {
  // General
  appName: "PlayType-Hybrid-Framework",
  defaultTimeout: 30000,
  logLevel: "info",
  headless: false,

  // API
  api_base_url: process.env.api_base_url || "",
  api_base_path: "/api",

  // UI
  dashboard_url: process.env.dashboard_url || "",
  dashboard_domain: process.env.domain || "",

  // Auth
  auth: {
    key: process.env.AUTH_KEY,
    state: {
      token: process.env.AUTH_TOKEN,
      user: {
        name: process.env.AUTH_USER_NAME,
        email: process.env.AUTH_USER_EMAIL,
        given_name: process.env.AUTH_GIVEN_NAME,
        family_name: process.env.AUTH_FAMILY_NAME,
        picture: process.env.AUTH_USER_PIC,
      }
    }
  },

  // Database
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
  },

  // Consul
  useConsul: false,
  consulHost: "127.0.0.1",
  consulPort: 8500,
  consulPrefix: "ParcelQuest",

  ENV,
};

export default config;
```

### Usage in Tests
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";

test("Use config values", async ({ rwService }) => {
  // Access via BaseTest.config
  const baseUrl = BaseTest.config.api_base_url;
  const dbEnabled = BaseTest.config.db.enabled;
  
  BaseTest.logger.info(`Testing against: ${baseUrl}`);
  BaseTest.logger.info(`Database testing: ${dbEnabled ? 'enabled' : 'disabled'}`);
});
```

---

## Consul Integration

### What is Consul?

Consul is a service mesh solution that provides:
- Service discovery
- Configuration management
- Health checking
- Key/Value store for dynamic configuration

### Enabling Consul
```typescript
// src/sharedUtils/config.ts

const config = {
  useConsul: true,
  consulHost: "127.0.0.1",
  consulPort: 8500,
  consulPrefix: "ParcelQuest",
  // ...
};
```

### Consul Setup

**1. Start Consul:**
```bash
# Using Docker
docker run -d -p 8500:8500 --name=consul consul

# Or install locally
brew install consul
consul agent -dev
```

**2. Add configuration to Consul:**
```bash
# Using Consul CLI
consul kv put ParcelQuest/api_base_url "https://api.example.com"
consul kv put ParcelQuest/db_enabled "true"

# Using Consul UI
# Navigate to http://localhost:8500/ui
# Key/Value -> Create -> Key: ParcelQuest/api_base_url
```

**3. Fetch from Consul:**
```typescript
// src/sharedUtils/consulConfig.ts

export async function fetchConsulConfig(
  host: string, 
  port: number, 
  key: string
): Promise<Record<string, any>> {
  const url = `http://${host}:${port}/v1/kv/${key}?raw`;
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch Consul KV: ${res.status}`);
  }

  const rawText = await res.text();
  
  // Parse key=value format
  const configObj: Record<string, any> = {};
  rawText.split(/\r?\n/).forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      configObj[key.trim()] = value.trim();
    }
  });

  return configObj;
}
```

**4. Use in config:**
```typescript
// src/sharedUtils/config.ts

import { fetchConsulConfig } from "./consulConfig.js";

let config = { /* defaults */ };

if (config.useConsul) {
  try {
    const consulConfig = await fetchConsulConfig(
      config.consulHost,
      config.consulPort,
      config.consulPrefix
    );
    
    // Merge Consul config
    config = { ...config, ...consulConfig };
  } catch (error) {
    console.error("Consul fetch failed, using defaults:", error);
  }
}
```

### Benefits of Consul

**Centralized Management:**
- Update config without redeploying tests
- Consistent config across multiple test runners
- Environment-specific overrides

**Dynamic Updates:**
- Change API endpoints on the fly
- Toggle feature flags
- Update credentials without code changes

**Audit Trail:**
- Track config changes
- Version history
- Rollback capability

---

## Multi-Environment Setup

### Environment-Specific Configurations

**Stage Environment (.env.stage):**
```env
api_base_url=https://api.staging.example.com
dashboard_url=https://app.staging.example.com
DB_ENABLED=true
PG_DB_HOST=staging-db.example.com
USE_SSH=true
```

**Production Environment (.env.prod):**
```env
api_base_url=https://api.example.com
dashboard_url=https://app.example.com
DB_ENABLED=false  # Don't write to prod DB
PG_DB_HOST=prod-db.example.com
USE_SSH=true
```

**Local Development (.env.local):**
```env
api_base_url=http://localhost:3000
dashboard_url=http://localhost:8080
DB_ENABLED=true
PG_DB_HOST=localhost
USE_SSH=false
```

### Conditional Logic Based on Environment
```typescript
import { test, expect, BaseTest } from "../../BaseApiTest.js";

test("Environment-specific behavior", async ({ rwService }) => {
  const env = BaseTest.config.ENV;
  
  if (env === 'prod') {
    // Production-specific checks
    test.skip(BaseTest.config.db.enabled, 'Skipping DB writes in prod');
  }
  
  if (env === 'stage') {
    // Stage-specific setup
    await setupTestData();
  }
  
  // Continue with test...
});
```

### Environment Variables in CI/CD

**GitHub Actions:**
```yaml
# .github/workflows/test.yml

name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    env:
      ENV: stage
      api_base_url: ${{ secrets.API_BASE_URL }}
      DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: make deps
      
      - name: Run tests
        run: make test
```

**GitLab CI:**
```yaml
# .gitlab-ci.yml

test:
  stage: test
  variables:
    ENV: stage
    api_base_url: $API_BASE_URL
    DB_PASSWORD: $DB_PASSWORD
  script:
    - make deps
    - make test
```

---

## Best Practices

### DO
```typescript
// Use config for all environment-specific values
const apiUrl = BaseTest.config.api_base_url;

// Provide sensible defaults
const timeout = BaseTest.config.defaultTimeout || 30000;

// Validate required config
if (!config.api_base_url) {
  throw new Error('api_base_url is required');
}

// Use type-safe access
const port: number = config.db.pgsql.port;

// Document config options
/**
 * API base URL
 * @example "https://api.example.com"
 * @required
 */
api_base_url: string;
```

### DON'T
```typescript
// Don't hardcode environment-specific values
const apiUrl = "https://api.staging.com";  // Bad

// Don't commit sensitive data
AUTH_TOKEN=actual-token-value  // Bad - use .env.local (gitignored)

// Don't use inconsistent naming
api_url vs apiUrl vs API_URL  // Pick one convention

// Don't skip validation
const dbHost = process.env.DB_HOST;  // What if undefined?
```

### Security Best Practices

**1. Gitignore sensitive files:**
```gitignore
# .gitignore
.env.local
.env.*.local
.env.prod
*.pem
*.key
```

**2. Use environment variables for secrets:**
```env
# Don't commit this file
DB_PASSWORD=secret-password
AUTH_TOKEN=jwt-token
SSH_KEY_PATH=/secure/path/key.pem
```

**3. Provide example file:**
```env
# .env.example (commit this)
api_base_url=https://api.example.com
DB_PASSWORD=your-password-here
AUTH_TOKEN=your-token-here
```

**4. Encrypt secrets in CI/CD:**
```bash
# GitHub Actions
gh secret set DB_PASSWORD

# GitLab
# Settings -> CI/CD -> Variables
```

---

## Examples

### Example 1: Multi-Region Testing
```typescript
// tests/multi-region.spec.ts

const regions = [
  { name: 'US', url: 'https://api.us.example.com' },
  { name: 'EU', url: 'https://api.eu.example.com' },
  { name: 'APAC', url: 'https://api.apac.example.com' },
];

regions.forEach(({ name, url }) => {
  test.describe(`${name} Region`, () => {
    test.use({
      apiContext: async ({}, use) => {
        const context = await request.newContext({ baseURL: url });
        await use(context);
        await context.dispose();
      }
    });

    test(`Test ${name} endpoint`, async ({ rwService }) => {
      const response = await rwService.getArticles();
      await rwService.assertStatus(response, 200);
    });
  });
});
```

### Example 2: Feature Flags
```typescript
// src/sharedUtils/config.ts

const config = {
  features: {
    newFeature: process.env.FEATURE_NEW === 'true',
    betaFeature: process.env.FEATURE_BETA === 'true',
  }
};

// In test
test("Test new feature", async ({ rwService }) => {
  test.skip(!BaseTest.config.features.newFeature, 'New feature not enabled');
  
  // Test new feature...
});
```

### Example 3: Dynamic Timeouts
```typescript
// src/sharedUtils/config.ts

const config = {
  timeouts: {
    short: Number(process.env.TIMEOUT_SHORT) || 5000,
    medium: Number(process.env.TIMEOUT_MEDIUM) || 15000,
    long: Number(process.env.TIMEOUT_LONG) || 30000,
  }
};

// In test
test("Long-running operation", async ({ rwService }) => {
  test.setTimeout(BaseTest.config.timeouts.long);
  
  // Long operation...
});
```

---

## Troubleshooting

### Issue: "Environment file not found"

**Solution:**
```bash
# Create from example
cp .env.example .env.stage

# Or specify different environment
ENV=local make test
```

### Issue: "Config value is undefined"

**Solution:**
```typescript
// Add validation
if (!config.api_base_url) {
  throw new Error('api_base_url not set in environment');
}

// Or provide default
const url = config.api_base_url || 'http://localhost:3000';
```

### Issue: "Consul connection failed"

**Solution:**
```bash
# Check Consul is running
curl http://localhost:8500/v1/status/leader

# Check key exists
consul kv get ParcelQuest/api_base_url

# Fallback to .env
# Set useConsul: false in config
```

---

## Summary

| Feature | Usage | File |
|---------|-------|------|
| **Environment Files** | `.env.stage`, `.env.prod` | Root directory |
| **Config Object** | `BaseTest.config.*` | `src/sharedUtils/config.ts` |
| **Consul** | `useConsul: true` | `src/sharedUtils/consulConfig.ts` |
| **Environment Selection** | `ENV=prod make test` | Makefile/CLI |

---

[Back to Main README](../README.md) | [Next: Utilities](./UTILITIES.md)