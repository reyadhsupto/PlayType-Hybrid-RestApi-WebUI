# Agent Context

Last updated: 2026-08-23

## Project Snapshot

- Framework: Playwright + TypeScript hybrid test automation
- Coverage: REST API and Web UI tests
- Key utilities: logging, validation, data generation, database checks, Allure reporting
- Config source: `.env.*` files and optional Consul runtime merge
- API fixtures now standardize on Playwright's `baseURL` and `extraHTTPHeaders` options

## Current Structure

- `src/api/` - API client, validation, service layer, payload helpers
- `src/ui/` - Page objects, shared UI actions, auth helpers, page object manager
- `src/sharedUtils/` - config, logger, database client, polling, data generation, reporting helpers
- `tests/` - Playwright test bases plus API/UI specs
- `fixtures/` - Playwright global setup and teardown

## Database Design

- Preferred access path: worker-scoped Playwright `dbClient` fixture from `tests/BaseApiTest.ts`
- Backward-compatible access: `BaseTest.dbClient` still points to the same worker-local service instance
- Execution model: create pools lazily on first use per database key inside each worker, reuse them across all queries in that worker, and close active resources in worker teardown
- Supported types: PostgreSQL and MySQL
- Connection registry: named entries from `DB_CONNECTIONS_JSON`
- SSH mode: each named database decides independently whether to use SSH and must provide its own SSH config when `useSsh=true`
- Optional prewarm: `dbClient.prewarm([...keys])` is available when a suite wants a small set of databases ready before the first query

## Polling Design

- Preferred access path: import `recurse`, `waitForResponseStatus`, or `waitForResponseFieldValue` from `src/sharedUtils/recurse.ts`
- Fixture access: `polling` fixture is available from `tests/BaseApiTest.ts`
- Static access: `BaseTest.polling` points to the shared helper bundle
- Execution model: command is repeated on every interval until the expected status or field value matches
- Logging: every attempt can log the current value, elapsed time, timeout, and last error
- Shared helpers also expose `getNestedValue` for dot/bracket path lookup inside response bodies
- Use cases: ride dispatch, driver acceptance, ride completion, payment settlement, wallet balance, and due amount updates

## Lifecycle Notes

- `globalSetup` remains responsible for file-based bootstrap only
- `globalTeardown` remains responsible for file cleanup and log finalization only
- Database pool startup and shutdown now happen inside Playwright worker fixtures

## Important Files

- `tests/BaseApiTest.ts` - Core API fixtures, sample service fixtures, and shared worker-scoped DB client
- `src/sharedUtils/recurse.ts` - polling helper implementation and helper bundle
- `src/sharedUtils/dbClient.ts` - pooled database client implementation
- `fixtures/global-setup.ts` - runtime config bootstrap
- `fixtures/global-teardown.ts` - runtime config cleanup and log footer
- `README.md` - user-facing DB example and framework overview
- `docs/POLLING.md` - polling helper documentation and examples

## Working Conventions

- Keep comments and JSDoc close to public methods and fixtures
- Prefer dependency injection through Playwright fixtures when adding shared test resources
- Avoid creating cross-process state in `globalSetup`
- Prefer polling helpers over ad hoc retry loops for eventual consistency checks
- Update this file whenever a major architectural decision changes

## Current DB Query Pattern

- Query flow: `dbClient.query(databaseKey, sql, params)`
- Pooling: long-lived worker-local pool created lazily per used database key
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
- The token is injected into `extraHTTPHeaders` only when present and does not overwrite an explicit test-level `Authorization`
- If the token is missing, API requests still run without an Authorization header
- UI auth continues to use the separate `AUTH_TOKEN` state for browser tests

## Multi Service API Base URLs

- Environment variables now include `user_api_base_url`, `resto_api_base_url`, and `driver_api_base_url`
- `src/sharedUtils/config.ts` exposes them under `config.api_base_urls`
- Legacy `api_base_url` remains the fallback for backward compatibility
- `tests/BaseApiTest.ts` now exposes `userApiContext`, `restoApiContext`, `driverApiContext`, and matching client fixtures for service-specific flows

## Calculate Bill Payload Builder

- `DataGenerator.buildCalculateBillPayload(...)` now accepts the full restaurant item list response
- The default flow selects up to 3 items that do not have addons
- Quantities are randomized between 1 and 3 per selected item
- If fewer than 3 no addon items are available, the payload uses the smaller set
- Addon fallback is optional and requires `fetchItemDetails` plus `allowAddonFallback=true`
- `FoodApi.getRestaurantItemDetails(itemId)` exists for addon aware item resolution

## Electron Testing Design

- Electron (packaged desktop app) UI testing lives under `src/ui/electron/`. The harness is **app-agnostic**: no product-specific names exist in the resolver, launcher, or fixtures - you point it at any packaged Electron app via env config.
- Config lives in `config.electron` (see `src/sharedUtils/config.ts` and `.env.stage`) with keys: `enabled`, `dmgPath`, `appBundleDir` (`electron/build/`), `binaryPath`, `launchTimeout`, `args`, `auth`. `dmgPath` defaults to `""` and `binaryPath` can be used standalone (installed binary); at least one of the two must be set or the harness throws a clear error.
- `src/ui/electron/electronPackageResolver.ts` resolves `.app` directly, `.dmg` via `hdiutil` (cached into `electron/build/`), `.AppImage` directly, extracts `.deb` via `dpkg-deb` and `.exe`/`.msi` via `7z`/`bsdtar`. The Windows launcher is found generically (top-level `.exe`, then `resources/app/`, then a recursive scan) - no hardcoded Pathao Resto names remain.
- Launch: `src/ui/electron/electronLauncher.ts` calls `_electron.launch({ executablePath, args })` with a fresh temporary `user-data-dir` per launch so Electron sessions start clean instead of reusing cached login state.
- Cleanup: `tests/baseElectronTest.ts` installs process shutdown hooks for `SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection` so the packaged app and temporary session dir are cleaned up on Ctrl+C or abrupt runner failures.
- Cold start: graceful waiting via `waitForReadyWindow()` which polls `firstWindow()` + `domcontentloaded` using the shared `recurse` polling helper (configurable predicate/timeout/interval). No fixed sleeps.
- Page objects: `ElectronBasePage extends BasePage` (`src/ui/pages/electronBasePage.ts`) adds `waitUntilReady()`, `mainProcess()`, `windowCount()`, `captureView()`, and a self-contained `takeScreenshot()` (ensures `.png` extension, creates `screenshots/`, attaches to report). All `BasePage` actions carry over because Electron windows are Playwright `Page`s.
- Page object manager: `src/ui/electron/electronPoManager.ts` is app-agnostic and registration based - `register(name, page)` / `get(name)` / `has(name)`. Registered pages automatically receive the owner's `app` and `appPath` so main-process helpers work.
- Fixtures: `tests/baseElectronTest.ts` exposes worker-scoped `electronApp` plus test-scoped core fixtures `electronPage`/`appElectron`/`appReady`/`electronPoManager`, and clearly labeled **sample** fixtures `pathaoApp`/`loginPage`/`restoApp` for the bundled "Pathao Resto" demo app (removable for another product).
- Project config: `playwright.config.ts` adds an `Electron` project with `testDir: './tests/electron'`.
- Makefile: `make prepare-electron` (prepare/extract bundle) and `make test-electron` (run Electron project). `make test-tag` infers the Electron project from `tests/electron/*` files or `@ELECTRON` markers.
- Specs: `tests/electron/appLaunch.spec.ts` is the generic app-agnostic smoke test; `tests/electron/login.spec.ts` is the sample demo spec that uses the sample fixtures. The leftover `pathaoApp.pause()` that hung previous runs was removed.
- Docs: `docs/ELECTRON_TESTING.md` documents the app-agnostic harness, configuration, where to place a packaged app (folder convention, picking between multiple builds, DMG caching), a "bring your own app" checklist, and the bundled demo. `docs/CONFIGURATION.md` and `docs/FIXTURES.md` now reflect the generic config/fixtures split.
- Auth: AUTH_TOKEN/localStorage auth is not yet applied for Electron; web `setupAuth` can be adapted via `electronApp.context().addInitScript` once credentials are available.
