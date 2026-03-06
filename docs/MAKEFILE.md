# Makefile Commands Reference

Complete guide to all Makefile targets and their usage.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup Commands](#setup-commands)
- [Test Execution](#test-execution)
- [Reporting](#reporting)
- [Monitoring](#monitoring)
- [Utilities](#utilities)
- [Variables](#variables)
- [Examples](#examples)

---

## Prerequisites

### Installation

**macOS/Linux**: Pre-installed

**Windows**: Install via Chocolatey
```powershell
choco install make
```

### Verification
```bash
make --version
# Should output: GNU Make 3.x or higher
```

---

## Setup Commands

### `make all`

**Purpose**: Complete setup (dependencies + Playwright + build)

**Usage**:
```bash
make all
```

**What it does**:
1. Installs npm dependencies
2. Installs Playwright Chromium browser
3. Runs TypeScript type-check

**Equivalent to**:
```bash
make deps && make playwright && make build
```

---

### `make node`

**Purpose**: Install Node.js via nvm (if not installed)

**Usage**:
```bash
make node
```

**What it does**:
- Checks if Node.js is installed
- If not, installs nvm
- Installs Node.js v22
- Displays installed versions

**Output**:
```
Node.js not found. Installing nvm and Node.js...
Node.js version: v22.x.x
npm version: 10.x.x
```

---

### `make deps`

**Purpose**: Install project dependencies from package.json

**Usage**:
```bash
make deps
```

**What it does**:
```bash
npm install
```

**When to use**:
- First time setup
- After pulling new changes
- After package.json updates

---

### `make playwright`

**Purpose**: Install Playwright Chromium browser

**Usage**:
```bash
make playwright
```

**What it does**:
```bash
npx playwright install chromium --with-deps
```

**Note**: Only installs Chromium for faster setup

---

### `make setup`

**Purpose**: Run deps + playwright installation

**Usage**:
```bash
make setup
```

**Equivalent to**:
```bash
make deps && make playwright
```

**Recommended**: Use this for initial setup

---

### `make build`

**Purpose**: TypeScript type-check (no compilation)

**Usage**:
```bash
make build
```

**What it does**:
```bash
npx tsc --noEmit
```

**When to use**:
- Before committing code
- After TypeScript changes
- Continuous integration

---

## Test Execution

### `make test`

**Purpose**: Run all tests (default environment: stage)

**Usage**:
```bash
make test
```

**With custom environment**:
```bash
make test ENV=prod
```

**With repeat count**:
```bash
make test RCOUNT=5
```

**What it does**:
```bash
NODE_ENV=stage npx playwright test --repeat-each=1
```

---

### `make test-env`

**Purpose**: Run tests with specific environment

**Usage**:
```bash
make test-env ENV=stage
make test-env ENV=prod
```

**Variables**:
- `ENV`: Environment name (default: `stage`)
- `RCOUNT`: Repeat count (default: `1`)

**Example**:
```bash
# Run prod tests 3 times
make test-env ENV=prod RCOUNT=3
```

---

### `make test-file`

**Purpose**: Run specific test file

**Usage**:
```bash
make test-file FILE=tests/api/testRealWorldApi/user.spec.ts
```

**With environment**:
```bash
make test-file FILE=tests/ui/createQuestPage.spec.ts ENV=prod
```

**With repeat**:
```bash
make test-file FILE=tests/api/user.spec.ts RCOUNT=10
```

**What it does**:
```bash
NODE_ENV=stage npx playwright test <FILE> --repeat-each=1
```

---

### `make test-tag`

**Purpose**: Run tests with specific tag(s)

**Single Tag**:
```bash
make test-tag TAG="smoke"
make test-tag TAG="regression"
make test-tag TAG="TC_001"
```

**AND Logic** (all tags must match):
```bash
make test-tag TAG="api and smoke"
make test-tag TAG="quest and create"
```

**OR Logic** (any tag matches):
```bash
make test-tag TAG="api or ui"
make test-tag TAG="TC_001 or TC_002 or TC_003"
```

**With environment and repeat**:
```bash
make test-tag TAG="smoke" ENV=prod RCOUNT=5
```

**How it works**:
- Single tag: `--grep "@smoke"`
- AND logic: `--grep "(?=.*@api)(?=.*@smoke)"`
- OR logic: `--grep "@api|@ui"`

**Examples**:
```bash
# Run all API tests
make test-tag TAG="api"

# Run smoke tests that are also API tests
make test-tag TAG="api and smoke"

# Run either login or registration tests
make test-tag TAG="login or registration"

# Run specific test IDs
make test-tag TAG="TC_001 or TC_002"

# Run 10 times for load testing
make test-tag TAG="performance" RCOUNT=10
```

---

## Reporting

### `make report`

**Purpose**: View Playwright HTML report

**Usage**:
```bash
make report
```

**What it does**:
```bash
npx playwright show-report reports
```

**Opens**: Browser with test results at `http://localhost:9323`

---

### `make allure-generate`

**Purpose**: Generate Allure report from results

**Usage**:
```bash
make allure-generate
```

**What it does**:
```bash
npx allure generate allure-results --clean -o allure-report
```

**Output**: `allure-report/` directory

---

### `make allure-open`

**Purpose**: Open Allure report in browser

**Usage**:
```bash
make allure-open
```

**What it does**:
```bash
npx allure open allure-report
```

**Prerequisites**: Run `make allure-generate` first

---

### `make allure-report`

**Purpose**: Generate and open Allure report with historical trends

**Usage**:
```bash
make allure-report
```

**What it does**:
1. Copies previous report history
2. Generates new report
3. Opens in browser

**Special feature**: Preserves trends across multiple runs

**Equivalent to**:
```bash
npx tsx src/sharedUtils/reportGeneratorAllure.ts
```

---

## Monitoring

### `make test-metrics`

**Purpose**: Generate Prometheus metrics from test results

**Usage**:
```bash
make test-metrics
```

**Prerequisites**: Run tests first to generate `playwright-report/results.json`

**What it does**:
```bash
npx tsx metrics/generate-metrics.ts
```

**Output**: `metrics/playwright-metrics.prom`

**Sample metrics**:
```prometheus
playwright_tests_total 15
playwright_tests_passed 12
playwright_tests_failed 2
playwright_tests_skipped 1
```

---

### `make monitoring-up`

**Purpose**: Start Prometheus + Grafana monitoring stack

**Usage**:
```bash
make monitoring-up
```

**What it does**:
```bash
docker-compose up
```

**Services started**:
- 🔵 Grafana: http://localhost:3000 (admin/admin)
- 🟠 Prometheus: http://localhost:9090
- 🟢 Metrics Server: http://localhost:9464/metrics

**Mode**: Runs in foreground (see logs)

**Stop**: Press `Ctrl+C`

---

### `make monitoring-down`

**Purpose**: Stop monitoring stack

**Usage**:
```bash
make monitoring-down
```

**What it does**:
```bash
docker-compose down
```

**Removes**: All containers, networks (preserves volumes)

---

## Utilities

### `make clean-logs`

**Purpose**: Delete and recreate logs directory

**Usage**:
```bash
make clean-logs
```

**What it does**:
```bash
rm -rf logs && mkdir logs
```

**Use case**: Clean up old log files

---

### `make help`

**Purpose**: Show all available commands

**Usage**:
```bash
make help
```

**Output**: List of all targets with descriptions

---

## Variables

### Environment Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `ENV` | `stage` | Environment name | `ENV=prod` |
| `RCOUNT` | `1` | Test repeat count | `RCOUNT=5` |
| `TAG` | - | Test tag filter | `TAG="smoke"` |
| `FILE` | - | Specific test file | `FILE=tests/api/user.spec.ts` |

### Usage Examples

**Single variable**:
```bash
make test ENV=prod
```

**Multiple variables**:
```bash
make test-tag TAG="smoke" ENV=prod RCOUNT=3
```

**Override in command**:
```bash
ENV=prod RCOUNT=10 make test
```

---

## Examples

### Complete Test Workflow
```bash
# 1. Setup (one-time)
make setup

# 2. Run tests
make test

# 3. View HTML report
make report

# 4. Generate Allure report
make allure-report

# 5. Generate metrics
make test-metrics

# 6. Start monitoring
make monitoring-up
```

### CI/CD Pipeline
```bash
# Clean setup
make clean-logs
make deps
make build

# Run tests
make test-tag TAG="smoke and api" ENV=prod

# Generate reports
make allure-generate

# Archive artifacts
tar -czf reports.tar.gz allure-report/ playwright-report/
```

### Development Workflow
```bash
# Check types
make build

# Run specific test during development
make test-file FILE=tests/api/user.spec.ts

# Quick smoke test
make test-tag TAG="smoke"

# Full regression
make test-tag TAG="regression" RCOUNT=2
```

### Load Testing
```bash
# Run performance tests 50 times
make test-tag TAG="performance" RCOUNT=50

# Generate metrics
make test-metrics

# Monitor in Grafana
make monitoring-up
```

### Environment Testing
```bash
# Stage sanity
make test-tag TAG="sanity" ENV=stage

# Production smoke
make test-tag TAG="smoke" ENV=prod

# Compare environments
make test-env ENV=stage && make test-env ENV=prod
```

---

## Troubleshooting

### Issue: `make: command not found`

**Solution**:
```bash
# macOS
brew install make

# Windows
choco install make

# Ubuntu/Debian
sudo apt-get install make
```

---

### Issue: `Node.js not found`

**Solution**:
```bash
make node
```

---

### Issue: Tests fail with "Executable doesn't exist"

**Solution**:
```bash
make playwright
```

---

### Issue: Permission denied

**Solution**:
```bash
chmod +x Makefile
```

---

## Advanced Usage

### Running Make in Silent Mode
```bash
make -s test
```

**Suppresses**: "Entering directory" messages

---

### Parallel Make
```bash
make -j4 test
```

**Runs**: Multiple targets in parallel (careful with test execution)

---

### Dry Run
```bash
make -n test
```

**Shows**: Commands that would be executed without running them

---

## Best Practices

### ✅ DO
```bash
# Use semantic targets
make test-tag TAG="smoke"

# Chain commands
make deps && make build && make test

# Use variables for flexibility
make test-tag TAG="$TEST_TAG" ENV="$ENVIRONMENT"
```

### ❌ DON'T
```bash
# Don't skip setup
make test  # Without running make setup first

# Don't ignore build errors
make build || make test  # Bad - run tests even if build fails

# Don't hardcode environment
# Bad: Always using stage
# Good: make test ENV=prod
```

---

## Summary

| Command | Purpose | Variables | Output |
|---------|---------|-----------|--------|
| `make all` | Complete setup | - | Dependencies installed |
| `make test` | Run all tests | `ENV`, `RCOUNT` | Test results |
| `make test-tag` | Run by tag | `TAG`, `ENV`, `RCOUNT` | Filtered results |
| `make test-file` | Run specific file | `FILE`, `ENV`, `RCOUNT` | Single file results |
| `make report` | View HTML report | - | Opens browser |
| `make allure-report` | Allure with trends | - | Opens browser |
| `make test-metrics` | Generate metrics | - | .prom file |
| `make monitoring-up` | Start monitoring | - | Docker containers |

---

[← Back to Main README](../README.md) | [Next: Examples →](./EXAMPLES.md)