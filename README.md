# Hybrid(RestApi + WebUi) Automation Framework Using Playwright & Typescript
Core Rest Api Automation framework leveraging Playwright, Typescript, Allure, Zod, Makefile, Prometheus, Grafana, Docker etc.
It follows an OOP structure with a **BaseTest** class for both api and ui, **Service/Page classes** (like POM/SOM for APIs and UIs), **validators**, and **data generators** for dynamic payloads, **Fixtures** for dynamicity.

---

## Folder Structure
```
playwright-api-framework/
│── playwright.config.ts            # Playwright config (base URL, reporters, retries)
│── tsconfig.json                   # TypeScript config
│── package.json                    # Dependencies & scripts
|-- package_lock.json.          
|-- Makefile                        #Build automation
│── .env.stage                      # Environment variables (baseURL, auth tokens etc.)
│── /playwright-report
│    └── results.json               #test run result
│── /metrics
│    ├── generateMetrics.ts         #Prometheus metrics generator(.prom)
│    ├── playwright-metics.prom     #Prometheus metrics file
│    └── server.ts                  #exposes metrics server

│── /src
│    ├── /api
│    │    ├── client.ts                 # Generic API client (Playwright api context call wrapper)
│    │    ├── validator.ts              # Schema validator (AJV  & Jod wrapper)
│    │
|    |-- /fixtures
|    |    |--global-setup.ts
|    |    |--global-teardown.ts
│    ├── /services
│    │    ├── baseService.ts            # baseService adapter for api call, assertions, validations
│    │    └── service-x  
│    │         |--endpoints.ts          # Utility for defining service endpoints
│    │
│    ├── /utils
│    │    ├── logger.ts                 # Logger (winston)
│    │    ├── dataGenerator.ts          # payloads, Random test data (faker.js)
│    │    ├── config.ts                 # env and consul based config currently
│    │    ├──consulConfig.ts            # Consul configuration
│    │    ├── dbClient.ts               # DataBase(Postgres) client config with ssh
│    │    ├── payloadGenerator.ts       # Generates api payloads
│    │    ├── rerportGeneratorAllure.ts       # Generates allure report(copies historical data)
│    │    └── config.ts                 # env based config currently
│
│── /tests
│    ├── /testServices                  #testcases for services from src/services
│    │    ├── xEndpoints.spec.ts        # Tests for x services
│    │
│    ├── BaseTest.ts                    #BaseTest setup
│    │-- schemas.ts                     # JSON Schemas for assertion/validation response
│
│── /report                             # Playwright/Allure reports (auto-generated)
│── prometheus.yml                      # Prometheus yml config
│── docker-compose.yml                  # services: grafana, prometheus, metrics server
│── Dockerfile.metrics                  # metrics docker config

```
---

## Framework Flow Diagram

```
+─────────────────────────────+
|         Test Cases          |
|   (/tests/*.spec.ts)        |
| - Imports BaseTest          |
| - Executes tests            |
| - Final assertions          |
+──────────────┬──────────────+
               |
               v
+─────────────────────────────+
|          BaseTest           |
| (/src/tests/baseTest.ts)    |
| - Runs setup fixtures       |
| - Calls PayloadGenerator    |
| - Builds payload            |
| - Instantiates services     |
| - Runs teardown fixtures    |
+──────────────┬──────────────+
               |
               v
+─────────────────────────────+
|     PayloadGenerator        |
| (/src/utils/payloadGen)     |
| - Creates static payload    |
| - If dynamic: calls         |
|   DataGenerator             |
+──────────────┬──────────────+
               |
               v
+─────────────────────────────+
|       DataGenerator         |
| (/src/utils/dataGen)        |
| - Generates dynamic fields  |
|   (UUID, timestamps, etc.)  |
| - Returns merged data       |
+──────────────┬──────────────+
               |
               v
+─────────────────────────────+
|      Specific Service       |
| (/src/services/xService.ts) |
| - Builds API params         |
| - Calls BaseService methods |
+──────────────┬──────────────+
               |
               v
+─────────────────────────────+
|         BaseService         |
| (/src/services/baseService) |
| - callApi() via ApiClient   |
| - Validate with Zod/AJV     |
| - Validate status codes     |
| - Optional DB validation    |
+───────────┬───────────────┬─+
            |               |
            v               v
+─────────────────────+      +─────────────────────────+
|      ApiClient       |     |        DBClient         |
| (/src/api/client)    |     | (/src/utils/db.ts)      |
| - Builds request     |     | - Creates SSH tunnel    |
| - Adds headers       |     | - Connects to DB        |
| - Sends HTTP request |     | - Executes SQL query    |
| - Logs req/res       |     | - Returns DB result     |
+────────────┬────────+      +─────────┬───────────────+
             |                         |
             v                         |
+─────────────────────────────+        |
| HTTP Request/Response      |         |
| (Playwright requestContext)|         |
+────────────┬───────────────+         |
             |                         |
             v                         |
+─────────────────────────────+ <───────+
|       Target API Server     |
+─────────────────────────────+


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


- **Test Cases**: Playwright spec files in `/tests` use service classes for API interactions.
- **Service Classes**: Encapsulate endpoint methods, validation logic, and interact with BaseService.
- **BaseService**: Provides shared API call logic, assertions, and schema validation.
- **ApiClient**: Handles low-level HTTP requests and responses.
- **Endpoints Utility**: Manages environment-based endpoint switching.
- **Schema Validation**: Validates API responses using AJV, Zod.
- **Data Generation**: Generates dynamic payloads using Faker.js.
- **Config & Environment**: Loads environment variables and configuration.
- **Logging**: Captures logs per test run.

---

##  Tech Stack

- **Language:** TypeScript
- **Test Runner:** Playwright Test
- **Assertions:** Playwright `expect`
- **Data Generator:** Faker.js
- **Schema Validation:** AJV, Zod
- **Logging:** Winston (Custom: Master and logs per test run)
- **CI/CD:** GitHub Actions (can be configured to run tests on push/PR)
- **Dependency Management:** NPM
- **Build:** TypeScript compiler
- **Reporting and Monitoring:** Playwright Reporter, Allure, Prometheus, Grafana
- **ENV Management:** Dotenv, Consul
- **Build Automation:** Makefile
- **Containerization:** Docker, Docker-Compose
---

##  Pre-requisites

- **Node js:** 22
---

##  Setup

1. **Clone the repo**

```bash
git clone <repo-url>
cd quest-api-automation
```
2. **Install Node.js (v22 recommended) -> if not pre-installed**

```bash
make node
```
3. **Install dependencies**

```bash
make deps
```
4. **Install Playwright browsers**

```bash
make playwright
```
5. **Compile TypeScript (optional check)**

```bash
make build
```
### .env configuration

create a .env.stage file in root directory
with:
```env
api_base_url = <url>
dashboard_url = <url>
domain = <domain>

# mysql configurations
MYS_DB_HOST=<db_host>
MYS_DB_PORT=<port>
MYS_DB_NAME=<db_name>

# postgres configurations
PG_DB_HOST=<pg_host>
PG_DB_PORT=<pg_port>
PG_DB_NAME=<pg_name>

# SSH settings
USE_SSH=<true/false>
SSH_HOST=<host>
SSH_PORT=<port>
SSH_USER=<user>
SSH_KEY_PATH=<your_path>
```
---

##  Running Tests
1. **Run all tests (default environment: stage)**

```bash
make test
```
2. **Run a specific test file**

```bash
make test-file FILE=tests/testServices/createQuest.spec.ts
```
3. **Run a specific test file with env**

```bash
make test-file FILE=tests/testServices/createQuest.spec.ts ENV=prod
```
4. **Run tests with environment** default is stage if not specified

```bash
make test-env ENV=stage
```
5. **Run tests with tags, run group tests** TAG=grp

```bash
make test-tag TAG="quest"
make test-tag TAG="quest and stop and start"
make test-tag TAG="quest or stop or start"
```
6. **Run tests/set of tests multiple times(Lead Generation)** RCOUNT=n (default n=1)

```bash
make test-tag TAG="quest" RCOUNT=n
make test-tag TAG="quest and stop and start" RCOUNT=n
make test-tag TAG="quest or stop or start" RCOUNT=n
```
7. **View HTML report**

```bash
make report
```
##  Adding Tests
1. **Create a Service Class**
```bash
Add a new service under src/services/<serviceName>Service.ts.

Define endpoint methods like getSomething(), createSomething().

Add validation methods (assertStatus, validateSchema, etc.).
```
2. **Write the Test Case**
```bash
Create a new test file inside tests/testServices/.

Import your service and use it within a Playwright test() block.
```
3. **Write the Request payload**
```bash
Use generator.ts for dynamic payloads with Faker.
```
4. **Add Test title, description, tag(group test)**
```bash
test('data-driven test', { tag: 'regression' }, async ({ page }) => {
  // ... test code
});

test('data-driven test', { tag: ['regression', 'api'] }, async ({ page }) => {
  // ... test code
});

test('basic test with annotation', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/12345',
  },
}, async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});
Annotations are displayed in the test report and can be accessed by custom reporters via the TestCase.annotations property.
```

5. **Parameterize tests**
```bash
[
  { name: 'Alice', expected: 'Hello, Alice!' },
  { name: 'Bob', expected: 'Hello, Bob!' },
  { name: 'Charlie', expected: 'Hello, Charlie!' },
].forEach(({ name, expected }) => {
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
  test(`testing with ${name}`, async ({ page }) => {
    await page.goto(`https://example.com/greet?name=${name}`);
    await expect(page.getByRole('heading')).toHaveText(expected);
  });
});
```
6. **Validate Responses**
```bash
Validate HTTP status, schema, and values using methods from the service.
```
##  Notes
- All API calls go through ApiClient.

- Schema validation is done via Validator.

- Dynamic payloads can be generated using Generator.

- Logs are stored in logs/ folder per test run.

- Use .env to manage base URLs, tokens, or credentials for stage/prod.

---
## Schema Validation
Our framework supports API response validation using two approaches:

1. **AJV (JSON Schema)**

**Purpose:** Validate API responses against a JSON schema (Draft-7 compatible).

**Example JSON schema:**
```ts
// tests/schemas.ts

export const createQuestSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    data: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  },
  required: ["message", "data"]
};
```

**Usage in tests:**
```ts
import { BaseTest } from "../BaseTest.js";
import { createQuestSchema } from "../schemas/schemas.js";

test("Validate Create Quest response using AJV", async () => {
  const response = await BaseTest.apiClient.callApi({
    path_param: "/v2/quests",
    method: "POST",
    payload: { ... }
  });

  const body = await response.json();
  const isValid = BaseTest.validator.validateSchema(createQuestSchema, body);
  expect(isValid).toBe(true);
});

```
> Logs detailed validation errors if schema mismatches.

2. **Zod (runtime schema + type validation)**

**Purpose:** Strong runtime type validation for API responses, supports objects and arrays.

**Example Zod schema:**
```ts
// tests/schemas.ts
import { z } from "zod";

export const createQuestSchemaZod = z.object({
  message: z.string(),
  data: z.object({
    id: z.string(),
  }),
});
```

**Usage in tests:**

```ts
import { BaseTest } from "../BaseTest.js";
import { createQuestSchemaZod } from "../schemas/schemas.js";

test("Validate Create Quest response using Zod", async () => {
  const response = await BaseTest.apiClient.callApi({
    path_param: "/v2/quests",
    method: "POST",
    payload: { ... }
  });

  await BaseTest.validateSchema(response, createQuestSchemaZod);
});

```

You can choose either depending on your preference.

---
## Response field value Validation

If you want to validate a specific field from response:
```ts
await BaseTest.validateField(response, "data.id", "expected-id-value");
```
If you want to validate a specific field from response:
```ts
await BaseTest.validateField(response, "data.items[0].id", "12345");
```

---
## Allure Reporting

This framework supports Allure reporting for advanced test result visualization.

### Prerequisites
- Java (required for Allure Commandline)
- Allure dependencies (already included in devDependencies)

### Usage

1. **Generate Allure Report**
   After running your tests, generate the Allure report:
   ```bash
   make allure-generate
   ```
   This will process results from the `allure-results` folder and create a report in `allure-report`.

2. **Open Allure Report**
   To view the report in your browser:
   ```bash
   make allure-open
   ```

3. **Generate and Open Allure Report (Combined)**
   To generate and immediately open the report:
   ```bash
   make allure-report
   ```

### Troubleshooting
- If you see an error about missing Java, install it (e.g., via Homebrew: `brew install openjdk`).
- Ensure your tests are configured to use the Allure reporter in `playwright.config.ts`:
  ```js
  reporters: [ ['allure-playwright'] ]
  ```
---

## Playwright Test Monitoring (Prometheus + Grafana + Docker)
This section explains how to generate Playwright test metrics and visualize them on Grafana dashboards.

**Pre-requisites**
- Docker Desktop

### How It Works

- Playwright runs tests and generates a JSON test report.

- A metrics generator script(metrics/generate-metics.ts) converts the JSON into Prometheus metrics (metrics/playwright-metrics.prom).

- A metrics server exposes those metrics on HTTP (/metrics).

- Prometheus scrapes the metrics server.

- Grafana visualizes results.

### Procedure

1. **Run Playwright Tests (Json report enabled)**
```bash
make test
```
This generates:
```
playwright-report/results.json
```

2. **Generate Prometheus metrics from Playwright results**
```bash
make test-metrics
```
This creates
```
metrics/playwright-metrics.prom
```
The `make test-metrics` target runs the TypeScript metrics script directly using `tsx` (no manual compile step required):

```bash
# invokes: npx tsx metrics/generate-metrics.ts
make test-metrics
```

If your environment does not have `tsx` locally, `npx tsx` will fetch it automatically. Alternatives:

- Compile then run (works on any Node setup):

```bash
npx tsc -p tsconfig.json --outDir .build
node .build/metrics/generate-metrics.js
rm -rf .build
```

- Run with `ts-node` ESM loader (less recommended due to loader warnings on some Node versions):

```bash
node --loader ts-node/esm metrics/generate-metrics.ts
```

3. **Start the monitoring stack (Prometheus + Grafana + Metrics server)**
 ```bash
 make monitoring-up
 or
 docker compose up -d
 ```
 This will spin up
 - Metrics Server at http://localhost:9464/metrics
 - Grafan UI at http://localhost:3000
 - Prometheus at http://localhost:9090

 >Now play

 ---
 ## Database Service (dbclient.ts)

The DatabaseService utility lets your Playwright tests or Node/TS project execute SQL queries against a PostgreSQL database, with optional SSH tunnel support.

### COnfiguration
DatabaseService reads DB & SSH settings from the config file.
**example config.ts**
```ts
export default {
  db: {
    enabled: true,
    host: "your-db-host",   // remote db host (actual DB host)
    port: 5432,
    name: "dbname",
    user: "dbuser",
    password: "secret",

    ssh: {
      useSsh: true,                          // <--- Toggle SSH ON/OFF
      host: "bastion.example.com",           // <--- SSH jump host
      port: 22,
      username: "ubuntu",
      privateKeyPath: "./id_rsa"             // Path to private key
    }
  }
};
```
> If useSsh = false, DB connects directly — no SSH tunnel will be used.

### Required Environment Variables (Optional)

```env
# mysql configurations
MYS_DB_HOST=<db_host>
MYS_DB_PORT=<port>
MYS_DB_NAME=<db_name>

# postgres configurations
PG_DB_HOST=<pg_host>
PG_DB_PORT=<pg_port>
PG_DB_NAME=<pg_name>

# SSH settings
USE_SSH=<true/false>
SSH_HOST=<host>
SSH_PORT=<port>
SSH_USER=<user>
SSH_KEY_PATH=<your_path>
```
### Usage
Run a DB query from anywhere (e.g., Playwright test):
```ts
import { DatabaseService } from "../utils/dbClient";

test("Verify DB record", async () => {
  const result = await DatabaseService.query(
    `SELECT * FROM users WHERE email = $1`,
    [ "test@example.com" ]
  );

  console.log(result);
});
```
### Connection Logic
```
if (useSsh == true)
     create SSH tunnel (port 5433)
     connect DB → localhost:5433
else
     connect DB → config.host:config.port

execute query
cleanup connection & tunnel
```

---

## 💙 Made with Love 

This framework is built and maintained with care, precision.

### Contributors
- **Reyad Hassan**

---

