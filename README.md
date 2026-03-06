# PlayType - Hybrid Test Automation Framework

A production-ready hybrid test automation framework built with **Playwright** and **TypeScript**, supporting both **REST API** and **Web UI** testing with advanced features like database validation, Prometheus monitoring, and Allure reporting.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Latest-green.svg)](https://playwright.dev/)
[![Node](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Test Execution](#test-execution)
- [Reporting & Monitoring](#reporting--monitoring)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)

---

## Features

### API Testing
- **Dual API client modes** - Structured (with baseURL) + Direct (full URL) calls
- **Response validation** - JSON Schema (AJV) + Zod with TypeScript integration
- **Database verification** - PostgreSQL & MySQL with SSH tunnel support
- **Dynamic data generation** - Faker.js integration for realistic test data
- **Request/response logging** - Winston logger with file rotation
- **Fixture-based architecture** - Clean dependency injection

### UI Testing
- **Page Object Model (POM)** - Maintainable, scalable test structure
- **Fixture-based setup** - Automatic browser lifecycle management
- **Auth state management** - Pre-configured authentication for faster tests
- **Network interception** - Mock APIs, modify responses, track requests
- **Screenshot capture** - Automatic failure screenshots

### Framework Features
- **TypeScript** - Full type safety and IntelliSense support
- **Playwright fixtures** - Test isolation and parallel execution
- **Winston logging** - Separate logs per test run + master log
- **Allure reports** - HTML reports with historical trends
- **Prometheus + Grafana** - Test metrics visualization and monitoring
- **Consul integration** - Centralized configuration management (optional)
- **Multi-environment** - Stage, production via .env files
- **Makefile automation** - Simple commands for all operations
- **Docker support** - Containerized monitoring stack

---
## Architecture

### High-Level Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                         Test Cases                              │
│                    (/tests/*.spec.ts)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Playwright Fixtures                          │
│        (apiContext, apiClient, rwService, poManager)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ↓                         ↓
┌───────────────────────────┐   ┌──────────────────────┐
│      BaseTest (API)       │   │    BasePage (UI)     │
│  Static Utilities:        │   │  Common Actions:     │
│  • logger                 │   │  • click, fill       │
│  • validator              │   │  • waitFor, hover    │
│  • generator              │   │  • screenshot        │
│  • dbClient               │   │  • network helpers   │
└────────────┬──────────────┘   └──────────┬───────────┘
             │                             │
             ↓                             ↓
┌───────────────────────────┐   ┌──────────────────────┐
│   Service Layer (API)     │   │  Page Objects (UI)   │
│   • realWorldService      │   │  • CreateQuestPage   │
│   • baseService           │   │  • UpdateQuestPage   │
└────────────┬──────────────┘   └──────────────────────┘
             │
             ↓
┌───────────────────────────┐
│      API Client           │
│  • callApi() - baseURL    │
│  • callDirectApi() - full │
└────────────┬──────────────┘
             │
             ↓
┌───────────────────────────┐
│  Playwright API Context   │
│  • HTTP Request/Response  │
│  • Cookie/Auth State      │
└───────────────────────────┘
```
### Additional Components:

**Test Execution + Reporting Flow (Allure Included with historical data)**
```
+─────────────────────────────+
|     Playwright Runner       |
+─────────────┬───────────────+
              |
              v
+─────────────────────────────+
|      Test Execution         |
|  (test specs & services)    |
+─────────────┬───────────────+
              |
              v
+─────────────────────────────+
|      Allure Results         |
|  /allure-results/*.json     |
+─────────────┬───────────────+
              |
              v
+─────────────────────────────+
|    Allure Report Build      |
|  npx allure generate        |
|  (Retains history folder)   |
+─────────────┬───────────────+
              |
              v
+─────────────────────────────+
|     Allure HTML Report      |
|  /allure-report/index.html  |
+─────────────────────────────+
```

**Metrics & Observability (Prometheus + Grafana)**
```
         PLAYWRIGHT TEST RUN
                  |
                  v
        +──────────────+
        | Metrics Server|
        | (9464 /metrics|
        | Prom-client)  |
        +──────────────+
                  |
        Prometheus scrapes metrics
                  |
                  v
        +───────────────────+
        |   Prometheus      |
        | (stores metrics)  |
        +─────────┬─────────+
                  |
                  v
        +───────────────────+
        |     Grafana       |
        | (Dashboards & UI) |
        +───────────────────+

```

---

## Project Structure
```
playtype-hybrid-framework/
├── 📂 src/
│   ├── 📂 api/
│   │   ├── client.ts                      # API client (callApi, callDirectApi)
│   │   ├── validator.ts                   # AJV & Zod validators
│   │   ├── 📂 apiUtils/
│   │   │   └── payloadGenerator.ts        # Test data generators
│   │   └── 📂 services/
│   │       ├── baseService.ts             # Base service with validations
│   │       └── 📂 realWorld/
│   │           └── realWorldEndpoints.ts  # Service endpoint methods
│   ├── 📂 ui/
│   │   ├── 📂 pages/
│   │   │   ├── basePage.ts               # Base page actions
│   │   │   ├── createQuestPage.ts        # Example page object
│   │   │   └── updateQuestPage.ts
│   │   ├── 📂 actions/
│   │   │   └── helperActions.ts          # Network interception, uploads
│   │   ├── 📂 uiUtils/
│   │   │   └── authUtils.ts              # Auth state setup
│   │   └── poManager.ts                  # Page Object Manager
│   └── 📂 sharedUtils/
│       ├── config.ts                      # Central configuration
│       ├── consulConfig.ts                # Consul integration
│       ├── dataGenerator.ts               # Faker.js wrapper
│       ├── dbClient.ts                    # PostgreSQL/MySQL client
│       ├── logger.ts                      # Winston logger
│       └── reportGeneratorAllure.ts       # Allure report with trends
├── 📂 tests/
│   ├── 📂 api/
│   │   ├── 📂 testRealWorldApi/
│   │   │   └── user.spec.ts              # API test examples
│   │   └── schemas.ts                    # Zod/JSON schemas
│   ├── 📂 ui/
│   │   └── createQuestPage.spec.ts       # UI test examples
│   ├── BaseApiTest.ts                    # API fixtures & BaseTest
│   └── baseUiTest.ts                     # UI fixtures
├── 📂 metrics/
│   ├── generate-metrics.ts               # Prometheus metrics generator
│   ├── playwright-metrics.prom           # Generated metrics file
│   └── server.ts                         # Metrics HTTP server
├── 📂 docs/                              # Documentation
│   ├── API_TESTING.md
│   ├── UI_TESTING.md
│   ├── FIXTURES.md
│   ├── DATABASE.md
│   └── EXAMPLES.md
├── 📄 .env.stage                         # Stage environment config
├── 📄 .env.prod                          # Production environment config
├── 📄 playwright.config.ts               # Playwright configuration
├── 📄 docker-compose.yml                 # Prometheus + Grafana
├── 📄 Makefile                           # Build automation
├── 📄 package.json                       # Dependencies
└── 📄 README.md                          # This file
```

---
## Quick Start

### Prerequisites

- **Node.js** >= 20
- **npm** or **yarn**
- **Make** (pre-installed on macOS/Linux, install via Chocolatey on Windows)

### Installation
```bash
# 1. Clone repository
git clone 
cd playtype-hybrid-framework

# 2. Install Node.js (if not installed)
make node

# 3. Install all dependencies + Playwright browsers
make setup

# 4. Verify setup
make build
```

### First Test Run
```bash
# Run all tests
make test

# Run specific test file
make test-file FILE=tests/api/testRealWorldApi/user.spec.ts

# Run tests with tag
make test-tag TAG="smoke"

# View HTML report
make report
```

---
## Documentation

Comprehensive guides available in `/docs`:

| Document | Description |
|----------|-------------|
| **[API Testing Guide](./docs/API_TESTING.md)** | API client usage, fixtures, validation strategies |
| **[UI Testing Guide](./docs/UI_TESTING.md)** | Page objects, auth setup, UI fixtures |
| **[Fixtures Guide](./docs/FIXTURES.md)** | Fixture usage, `test.use()` overrides, examples |
| **[Database Testing](./docs/DATABASE.md)** | DB queries, SSH tunneling, validation |
| **[Configuration Guide](./docs/CONFIGURATION.md)** | Environment setup, Consul, multi-env |
| **[Utilities Reference](./docs/UTILITIES.md)** | Logger, data generator, validators |
| **[Examples](./docs/EXAMPLES.md)** | Common testing patterns and recipes |
| **[Makefile Commands](./docs/MAKEFILE.md)** | Complete Makefile reference |

---
## Test Execution

### Using Makefile (Recommended)
```bash
# Run all tests (default: stage environment)
make test

# Run with specific environment
make test-env ENV=prod

# Run specific test file
make test-file FILE=tests/api/testRealWorldApi/user.spec.ts

# Run with custom environment for specific file
make test-file FILE=tests/ui/createQuestPage.spec.ts ENV=prod

# Run tests with tag
make test-tag TAG="regression"
make test-tag TAG="smoke and api"
make test-tag TAG="TC_001 or TC_002"

# Run tests multiple times (lead generation)
make test RCOUNT=5
make test-tag TAG="smoke" RCOUNT=10
```

### Using npm
```bash
# Run all tests
npm test

# Run specific test
npx playwright test tests/api/user.spec.ts

# Run with grep pattern
npx playwright test --grep @smoke

# Run in headed mode
npx playwright test --headed

# Run with specific browser
npx playwright test --project=chromium
```

### Test Filtering
```bash
# By tag
make test-tag TAG="api"              # Single tag
make test-tag TAG="api and smoke"    # AND logic
make test-tag TAG="api or ui"        # OR logic

# By test ID
make test-tag TAG="TC_001"
make test-tag TAG="TC_001 or TC_002 or TC_003"

# By describe block
npx playwright test --grep "User Registration"

# Exclude tests
npx playwright test --grep-invert @skip
```

### Parallel Execution
```bash
# Run with 4 workers
npx playwright test --workers=4

# Fully parallel mode
npx playwright test --fully-parallel

# Serial mode (one by one)
npx playwright test --workers=1
```

---
## Reporting & Monitoring

### Playwright HTML Reports
```bash
# View latest report
make report

# Generate fresh report
npx playwright show-report
```

### Allure Reports

Allure provides beautiful HTML reports with:
- Test execution trends over time
- Duration statistics
- Failure categorization
- Screenshots on failures
- Request/response logs
```bash
# Generate and open Allure report (with historical trends)
make allure-report

# Or step by step:
make allure-generate    # Generate report
make allure-open        # Open in browser
```

**Allure Features:**
- Historical trends (passes/failures over time)
- Categorized failures
- Timeline visualization
- Detailed test logs
- Screenshot attachments

### Prometheus + Grafana Monitoring

Monitor test metrics in real-time:
```bash
# 1. Run tests to generate metrics
make test

# 2. Generate Prometheus metrics
make test-metrics

# 3. Start monitoring stack (Prometheus + Grafana)
make monitoring-up
```

**Access Dashboards:**
- 🔵 **Grafana**: http://localhost:3000 (admin/admin)
- 🟠 **Prometheus**: http://localhost:9090
- 🟢 **Metrics Server**: http://localhost:9464/metrics

**Stop Monitoring:**
```bash
make monitoring-down
```

**Available Metrics:**
- `playwright_tests_total` - Total test count
- `playwright_tests_passed` - Passed tests
- `playwright_tests_failed` - Failed tests
- `playwright_tests_skipped` - Skipped tests
- `playwright_test_duration_seconds` - Test duration

### Logs

Winston logger creates structured logs:
```
logs/
├── test-run-<timestamp>.log    # Current run (debug level)
└── master.log                  # All runs (append mode)
```

**Log Levels:**
- `info` - Important events (console + file)
- `debug` - Detailed debugging (file only)
- `warn` - Warnings
- `error` - Errors with stack traces

**Usage in tests:**
```typescript
BaseTest.logger.info("Test starting...");
BaseTest.logger.debug("Detailed debug info");
BaseTest.logger.error("Test failed:", error);
```

---
## Configuration

### Environment Files

Create `.env.stage` or `.env.prod`:
```env
# API Configuration
api_base_url=https://api.realworld.io
api_base_path=/api

# UI Configuration
dashboard_url=https://app.example.com
domain=.example.com

# Database (PostgreSQL)
DB_ENABLED=true
PG_DB_HOST=localhost
PG_DB_PORT=5432
PG_DB_NAME=testdb
DB_USER=postgres
DB_PASSWORD=secret

# Database (MySQL)
MYS_DB_HOST=localhost
MYS_DB_PORT=3306
MYS_DB_NAME=testdb

# SSH Tunnel (optional)
USE_SSH=false
SSH_HOST=bastion.example.com
SSH_PORT=22
SSH_USER=ubuntu
SSH_KEY_PATH=~/.ssh/id_rsa

# Auth (UI Tests)
AUTH_KEY=authState
AUTH_TOKEN=your-token-here
AUTH_USER_EMAIL=test@example.com
AUTH_USER_NAME=Test User
```

### Consul Configuration (Optional)

Enable centralized config management:
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

Consul allows dynamic configuration updates without redeploying tests.

---
## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Language** | TypeScript 5.0 | Type safety, IntelliSense |
| **Test Runner** | Playwright Test | API & UI testing |
| **Assertions** | Playwright expect | Built-in assertions |
| **Data Generation** | Faker.js | Realistic test data |
| **Validation** | AJV + Zod | Schema validation |
| **Logging** | Winston | Structured logging |
| **Reporting** | Allure, Playwright HTML | Test reports |
| **Monitoring** | Prometheus + Grafana | Metrics & dashboards |
| **Config** | dotenv + Consul | Environment management |
| **Database** | pg + mysql2 | PostgreSQL & MySQL |
| **Build** | TypeScript compiler | Compilation |
| **Automation** | Makefile | Build automation |
| **Containers** | Docker + Docker Compose | Monitoring stack |

---

## Makefile Commands Reference

### Setup & Installation
```bash
make all             # Full setup (deps + playwright + build)
make node            # Install Node.js via nvm
make deps            # Install npm dependencies
make playwright      # Install Playwright browsers
make setup           # Install deps + playwright
make build           # TypeScript type-check
```

### Testing
```bash
make test                                    # Run all tests (stage env)
make test-env ENV=prod                       # Run with specific env
make test-file FILE=                   # Run specific file
make test-file FILE= ENV=prod          # Run file with env
make test-tag TAG="smoke"                    # Run by tag
make test-tag TAG="api and smoke"            # AND condition
make test-tag TAG="api or ui"                # OR condition
make test RCOUNT=5                           # Repeat tests 5 times
make test-tag TAG="smoke" RCOUNT=10          # Repeat tag tests
```

### Reporting
```bash
make report                  # View Playwright HTML report
make allure-generate         # Generate Allure report
make allure-open             # Open Allure report
make allure-report           # Generate + open with trends
```

### Monitoring
```bash
make test-metrics            # Generate Prometheus metrics
make monitoring-up           # Start Prometheus + Grafana
make monitoring-down         # Stop monitoring stack
```

### Utilities
```bash
make clean-logs              # Delete and recreate logs directory
make help                    # Show all available commands
```

---

## Advanced Usage

### Override Fixtures with test.use()

Override baseURL for specific tests:
```typescript
// File-level override
test.use({
  apiContext: async ({}, use) => {
    const context = await request.newContext({
      baseURL: "https://api.github.com"
    });
    await use(context);
    await context.dispose();
  }
});

test("GitHub API test", async ({ apiClient }) => {
  // Uses GitHub base URL
});
```

See [Fixtures Guide](./docs/FIXTURES.md) for complete examples.

### Database Validation
```typescript
test("Verify DB record", async ({ rwService }) => {
  // Create via API
  const response = await rwService.registerUser(payload);
  const { email } = (await response.json()).user;

  // Verify in database
  const dbResults = await BaseTest.dbClient.query(
    'postgres',
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  expect(dbResults.length).toBe(1);
  expect(dbResults[0].email).toBe(email);
});
```

### Network Interception (UI)
```typescript
test("Mock API response", async ({ poManager }) => {
  const page = poManager.getCreateQuestPage().page;

  // Intercept and mock response
  await page.route('**/api/quests', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true })
    });
  });

  // Continue test with mocked response
});
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- Use TypeScript strict mode
- Follow existing code style
- Add JSDoc comments for public methods
- Write tests for new features
- Update documentation
- Run `make build` before committing

---

## License

This project is licensed under the MIT License.

---

## Contributors

- **Reyad Hassan** - *Initial work*

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

---

## Acknowledgments

- Playwright team for the amazing testing framework
- Community contributors
- Open source libraries used in this project

---

**Built with ❤️ using Playwright, TypeScript & Makefile**

⭐ Star this repo if you find it useful!

---

## Quick Links

- [API Testing Guide](./docs/API_TESTING.md)
- [UI Testing Guide](./docs/UI_TESTING.md)
- [Fixtures Reference](./docs/FIXTURES.md)
- [Database Guide](./docs/DATABASE.md)
- [Examples](./docs/EXAMPLES.md)
- [Makefile Commands](./docs/MAKEFILE.md)



---

