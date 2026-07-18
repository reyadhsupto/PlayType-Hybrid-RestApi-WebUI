# Agent Context

Last updated: 2026-07-18

## Project Snapshot

- Framework: Playwright + TypeScript hybrid test automation
- Coverage: REST API and Web UI tests
- Key utilities: logging, validation, data generation, database checks, Allure reporting
- Config source: `.env.*` files and optional Consul runtime merge

## Current Structure

- `src/api/` - API client, validation, service layer, payload helpers
- `src/ui/` - Page objects, shared UI actions, auth helpers, page object manager
- `src/sharedUtils/` - config, logger, database client, data generation, reporting helpers
- `tests/` - Playwright test bases plus API/UI specs
- `fixtures/` - Playwright global setup and teardown

## Database Design

- Preferred access path: worker-scoped Playwright `dbClient` fixture from `tests/BaseApiTest.ts`
- Backward-compatible access: `BaseTest.dbClient` still points to the same worker-local service instance
- Execution model: create pools once per worker process, reuse them across all queries in that worker, close them in worker teardown
- Supported types: PostgreSQL and MySQL
- Connection registry: named entries from `DB_CONNECTIONS_JSON` or legacy env fallbacks
- SSH mode: each named database decides independently whether to use SSH and must provide its own SSH config when `useSsh=true`

## Lifecycle Notes

- `globalSetup` remains responsible for file-based bootstrap only
- `globalTeardown` remains responsible for file cleanup and log finalization only
- Database pool startup and shutdown now happen inside Playwright worker fixtures

## Important Files

- `tests/BaseApiTest.ts` - API test fixtures and shared worker-scoped DB client
- `src/sharedUtils/dbClient.ts` - pooled database client implementation
- `fixtures/global-setup.ts` - runtime config bootstrap
- `fixtures/global-teardown.ts` - runtime config cleanup and log footer
- `README.md` - user-facing DB example and framework overview

## Working Conventions

- Keep comments and JSDoc close to public methods and fixtures
- Prefer dependency injection through Playwright fixtures when adding shared test resources
- Avoid creating cross-process state in `globalSetup`
- Update this file whenever a major architectural decision changes

## Current DB Query Pattern

- Query flow: `dbClient.query(databaseKey, sql, params)`
- Pooling: long-lived worker-local pool
- Cleanup: automatic on worker completion, even when a test fails and the worker stops

## Environment Snapshot

- `.env.stage` currently uses `DB_CONNECTIONS_JSON` with named keys for `quest-postgres` and `pathao-mysql`
- Both stage databases currently use SSH tunneling through the bastion host

## Assertion Pattern

- Service-level assertion helpers now accept `mode: "hard" | "soft"`
- Default mode is `hard`, which throws immediately on failure
- Soft mode logs, attaches report details, and records the failure without stopping execution
- Use `assertNoSoftAssertionFailures()` at the end of a flow when you want a final aggregated failure signal
- Keep blockers such as auth and core status checks in hard mode, and use soft mode for secondary validation

## API Auth Pattern

- API request contexts use a static bearer token from `API_BEARER_TOKEN` or `API_GATEWAY_BEARER_TOKEN`
- The token is injected into `extraHTTPHeaders` only when present
- If the token is missing, API requests still run without an Authorization header
- UI auth continues to use the separate `AUTH_TOKEN` state for browser tests
