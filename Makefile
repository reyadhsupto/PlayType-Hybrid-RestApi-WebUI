# Project Setup Makefile for Playwright API Automation (TypeScript)

NODE_VERSION := 20
PROJECT_NAME := playtype-hybrid-resapi-webui
ENV ?= stage
RCOUNT ?= 1

# Default target
.DEFAULT_GOAL := help

# Default target( install nodejs, dependencies from package.json, install playwright)
.PHONY: all
all: setup build

# Install Node.js by homebrew in macos (if !exist)
.PHONY: node
node:
	@if ! command -v node >/dev/null 2>&1; then \
		echo "Node.js not found. Installing nvm and Node.js..."; \
		curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash; \
		. "$$HOME/.nvm/nvm.sh"; \
		nvm install 22; \
		echo "Node.js version:"; \
		node -v; \
		echo "npm version:"; \
		npm -v; \
	else \
		echo "Node.js already installed. Version:"; \
		node -v; \
	fi

# Install dependencies from package.json
.PHONY: deps
deps:
	@echo "⚡ Installing dependencies from package.json..."
	npm install

# Install Playwright (API mode - no browsers unless needed)
.PHONY: playwright
playwright:
	@echo "⚡ Installing Playwright browsers (Chromium only)..."
	npx playwright install chromium --with-deps

# Aggregate setup
.PHONY: setup
setup: deps playwright

# Build & Type-check
.PHONY: build
build:
	npx tsc --noEmit

# Run tests
.PHONY: test
test:
	NODE_ENV=${ENV} npx playwright test --repeat-each=$(RCOUNT)

# Run specific test (usage: make test FILE=tests/testServices/createQuest.spec.ts)
.PHONY: test-file
test-file:
	NODE_ENV=${ENV} npx playwright test $(FILE) --repeat-each=$(RCOUNT)

# Run tests by tag(s)
# Usage:
#   make test-tag TAG="quest"
#   make test-tag TAG="quest and stopQuest"
#   make test-tag TAG="PQDS_003 or PQDS_004 or PQDS_004"
.PHONY: test-tag
test-tag:
	@if [ -z "$(TAG)" ]; then \
		echo "Please provide TAG parameter. Example: make test-tag TAG=\"quest\""; \
		exit 1; \
	elif echo "$(TAG)" | grep -q " and "; then \
		TAGS=$$(echo "$(TAG)" | tr " " "\n" | grep -v "and"); \
		REGEX=""; \
		for tag in $$TAGS; do \
			REGEX="$$REGEX(?=.*@$$tag)"; \
		done; \
		NODE_ENV=$(ENV) npx playwright test --grep "$$REGEX" --repeat-each=$(RCOUNT); \
	elif echo "$(TAG)" | grep -q " or "; then \
		TAGS=$$(echo "$(TAG)" | tr " " "\n" | grep -v "or"); \
		REGEX=""; \
		for tag in $$TAGS; do \
			REGEX="$$REGEX@$$tag|"; \
		done; \
		REGEX=$${REGEX%|}; \
		NODE_ENV=$(ENV) npx playwright test --grep "$$REGEX" --repeat-each=$(RCOUNT); \
	else \
		echo "Running tests matching tag: @$(TAG) with repeat-each=$(RCOUNT)"; \
		NODE_ENV=$(ENV) npx playwright test --grep "@$(TAG)" --repeat-each=$(RCOUNT); \
	fi


# Run tests with env
# make test-env ENV=prod
# make test-env ENV=stage
.PHONY: test-env
test-env:
	@echo "⚡ Running tests with $(ENV) environment"
	NODE_ENV=${ENV} npx playwright test --repeat-each=$(RCOUNT)

# Show HTML report
.PHONY: report
report:
	npx playwright show-report reports

# Generate Allure report
.PHONY: allure-generate
allure-generate:
	npx allure generate allure-results --clean -o allure-report

# Open Allure report
.PHONY: allure-open
allure-open:
	npx allure open allure-report

# Generate and open Allure report
.PHONY: allure-report
allure-report:
	npx tsx src/sharedUtils/reportGeneratorAllure.ts

# Clean logs
.PHONY: clean-logs
clean-logs:
	rm -rf logs && mkdir logs

.PHONY: test-metrics
test-metrics:
	@echo "Generating Prometheus metrics from playwright test-result.json ..."
	npx tsx metrics/generate-metrics.ts
	@echo "Metrics generated.."

.PHONY: monitoring-up
monitoring-up:
	@echo "\nStarting Prometheus + Grafana... in docker un-detached mode"
	docker-compose up
	@echo "Monitoring stack is running."
	@echo "➡ Grafana:   http://localhost:3000 (user: admin / pass: admin)"
	@echo "➡ Prometheus: http://localhost:9090"

.PHONY: monitoring-down
monitoring-down:
	@echo "\nStopping monitoring stack..."
	docker-compose down
	@echo "Prometheus + Grafana stopped."

.PHONY: help
help: ## Show all available commands
	@echo ""
	@echo "Usage: make <target> [VARIABLE=value]"
	@echo ""
	@echo "Available targets:"
	@echo "  all            - Run full setup (dependencies, Playwright) and build the project"
	@echo "  node           - Install Node.js via Homebrew if missing"
	@echo "  deps           - Install npm dependencies from package.json"
	@echo "  playwright     - Install Playwright Chromium browser (API testing only)"
	@echo "  setup          - Run Node.js, dependencies, and Playwright install together"
	@echo "  build          - Type-check the project with TypeScript"
	@echo "  test           - Run all Playwright tests"
	@echo "  test-tag       - Run tests with a specific tag (usage: make test-tag TAG="quest" ;TAG="quest or stop"); TAG="quest and stop")"
	@echo "  test-file      - Run a specific test file (usage: make test-file FILE=tests/example.spec.ts)"
	@echo "  test-env       - Run tests with .env configuration"
	@echo "  report         - Show Playwright HTML test report"
	@echo "  allure-generate  - Generate Allure report from allure-results"
	@echo "  allure-open      - Open Allure report in browser"
	@echo "  allure-report    - Generate and open Allure report with historical data preservation"
	@echo "  clean-logs       - Delete and recreate logs directory"
	@echo "  test-metrics     - Generates Prometheus Metrics"
	@echo "  monitoring-up    - Starts monitoring"
	@echo "  monitoring-down  - Stops monitoring"
	@echo ""
