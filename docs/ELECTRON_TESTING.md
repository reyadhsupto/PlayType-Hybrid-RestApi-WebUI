# Electron Testing Guide

Complete guide to testing packaged Electron (desktop) applications within the
PlayType framework.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Where to Place Your Packaged App](#where-to-place-your-packaged-app)
- [Configuration](#configuration)
- [DMG Preparation](#dmg-preparation)
- [Graceful First Launch](#graceful-first-launch)
- [Fixtures & Page Objects](#fixtures--page-objects)
- [Page Object Manager](#page-object-manager)
- [Main-Process Helpers](#main-process-helpers)
- [Screenshots](#screenshots)
- [Running Electron Tests](#running-electron-tests)
- [Bring Your Own App](#bring-your-own-app)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

Playwright ships with first-class Electron support through `_electron.launch()`.
This framework wraps that capability into an **app-agnostic Electron harness**, so
you can test the same way as any packaged desktop app regardless of the product:

- Resolve a packaged artifact (`.app`, `.dmg`, `.AppImage`, `.deb`, `.exe`, `.msi`)
  or an already installed binary from configuration
- Launch the app once per Playwright worker and reuse it across the worker's tests
- Graceful cold-start waiting (polling, not a fixed sleep)
- Generic `electronPage` fixture with main-process helpers
- Generic registration-based `ElectronPOManager` for your own page objects
- Screenshot capture attached to the HTML/Allure report

Because the desktop window is a Playwright `Page`, every standard web
automation action (click, fill, wait, select, drag, screenshot) works unchanged.

The repository also includes a **sample app** ("Pathao Resto") with demo page
objects, fixtures, and specs that show the pattern on a real application. The
sample is clearly separated from the core harness and can be removed or replaced
when you bring your own app.

---

## Architecture

```
Electron test spec
    |
    v
tests/baseElectronTest.ts (fixtures: electronApp, electronPage, electronPoManager, ...)
    |
    v
Electron page objects (extend ElectronBasePage -> BasePage)  [generic + sample]
    |
    v
ElectronBasePage (setup, waitUntilReady, takeScreenshot, mainProcess, captureView)
    |
    v
electronLauncher (launch, graceful wait, close)
    |
    v
electronPackageResolver (resolve package, extract/cache bundle, detect binary)
    |
    v
_electron.launch() -> ElectronApplication -> firstWindow() = Page
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **electronPackageResolver** | Resolve/extract package (`.app`, `.dmg`, `.AppImage`, `.deb`, `.exe`, `.msi`) and detect binary | `src/ui/electron/electronPackageResolver.ts` |
| **electronLauncher** | Launch + graceful wait + close + temp-session cleanup | `src/ui/electron/electronLauncher.ts` |
| **prepareScript** | CLI that prepares/caches the app without launching it | `src/ui/electron/prepareScript.ts` |
| **ElectronBasePage** | App-agnostic Electron page object base | `src/ui/pages/electronBasePage.ts` |
| **ElectronPOManager** | App-agnostic registration-based page object manager | `src/ui/electron/electronPoManager.ts` |
| **Fixtures** | App + page lifecycle | `tests/baseElectronTest.ts` |
| **Sample page object** | Bundled "Pathao Resto" demo app (removable) | `src/ui/pages/electronPathaoAppPage.ts` |
| **Sample login page** | Bundled "Pathao Resto" demo login (removable) | `src/ui/pages/electronLoginPage.ts` |

---

## How It Works

1. The config points at a packaged artifact or an installed binary.
2. `prepareElectronApp()` resolves the bundle:
   - `ELECTRON_BINARY_PATH` (when set) is used directly; no package handling.
   - `.app` is used directly (macOS).
   - `.dmg` is mounted, its `.app` is copied into `electron/build/` (cached), and the volume is detached.
   - `.AppImage` is launched directly (Linux).
   - `.deb` is extracted with `dpkg-deb`; the binary is discovered generically.
   - `.exe` / `.msi` are extracted with `7z` or `bsdtar`; the launcher is discovered
generically (top-level, then `resources/app/`, then recursive scan - no
product-specific names are assumed).
3. `electronLauncher.launchElectronApp()` calls `_electron.launch({ executablePath, args })`
   with a fresh temporary `--user-data-dir`, so each session starts clean.
4. The main window is obtained via `electronApp.firstWindow()` after a graceful
   readiness poll and exposed as a Playwright `Page`.
5. Tests reuse the same app instance within the worker; the app is closed and the
temporary session removed on worker teardown.

---

## Where to Place Your Packaged App

- The harness resolves exactly **one** packaged artifact per run. `ELECTRON_DMG_PATH`
  is the exact path (project-relative or absolute) to that artifact.
- Repo convention: keep bundles under `resources/`. Example:
  `resources/MyApp-1.0.0-universal.dmg`. You may also keep the file anywhere on
disk and point `ELECTRON_DMG_PATH` at its full path.
- **Multiple builds of the same app** (e.g. `x64`, `arm64`, `universal`): place
  the files anywhere and set `ELECTRON_DMG_PATH` to the one you want to run. That
  env variable is how you pick which build is exercised.
- **DMG containing several `.app` bundles**: the resolver uses the **first** `.app`
  found on the mounted volume. Keep only the app you intend to test inside the
  DMG, or bypass DMG handling entirely by setting `ELECTRON_BINARY_PATH` to the
executable of the `.app` you want.
- **Already built/extracted app**: set `ELECTRON_BINARY_PATH` to the executable
  (macOS: `<App>.app/Contents/MacOS/<name>`) and the harness will not touch any
package. This also works on CI machines where the app is deployed locally.
- **Caching**: `.app` bundles extracted from a DMG are cached in `electron/build/`
  (git-ignored). If you switch to a different app, delete `electron/build/`
  (or run `make clean-electron`) so a stale bundle is not reused.

---

## Configuration

Add to your `.env.<env>` file:

```env
# ==================================
# Electron (packaged desktop app) UI Testing
# ==================================
ELECTRON_ENABLED=true
ELECTRON_DMG_PATH="resources/MyApp-1.0.0-universal.dmg"
ELECTRON_BINARY_PATH=""
ELECTRON_LAUNCH_TIMEOUT=90000
ELECTRON_ARGS=""
# Credentials used by the sample/demo page objects (and any auth page you add)
ELECTRON_APP_EMAIL=""
ELECTRON_APP_PASSWORD=""
```

Mapping to `config.electron`:

| Env Variable | Config Key | Description | Default |
|--------------|------------|-------------|---------|
| `ELECTRON_ENABLED` | `enabled` | Master switch; when false the `electronApp` fixture fails fast with a clear message | `false` |
| `ELECTRON_DMG_PATH` | `dmgPath` | Path to a packaged app artifact (`.app`, `.dmg`, `.AppImage`, `.deb`, `.exe`, `.msi`) | `""` |
| `ELECTRON_BINARY_PATH` | `binaryPath` | Optional explicit path to the app executable; takes priority over package resolution | `""` |
| `ELECTRON_LAUNCH_TIMEOUT` | `launchTimeout` | Max ms to wait for the app process to boot | `60000` |
| `ELECTRON_ARGS` | `args` | Extra CLI args forwarded to the app (comma separated) | `""` |
| `ELECTRON_APP_EMAIL` | `auth.email` | Demo login email used by sample page objects | `""` |
| `ELECTRON_APP_PASSWORD` | `auth.password` | Demo login password used by sample page objects | `""` |

At least one of `ELECTRON_DMG_PATH` or `ELECTRON_BINARY_PATH` must be set;
otherwise the harness throws a clear "No Electron app configured" error.
`config.electron.appBundleDir` (cached `.app` bundles) is fixed to
`electron/build/`.

---

## DMG Preparation

The first time you run an Electron test (or `make prepare-electron`), a
configured DMG is mounted, its `.app` bundle is extracted into
`config.electron.appBundleDir` (`electron/build/`), and the volume is detached.
The bundle is then cached, so subsequent runs skip extraction.

```bash
# One-time (optional) preparation, without launching the app
make prepare-electron

# Output:
# [Prepare] Bundle ready: <project>/electron/build/MyApp.app
# [Prepare] Binary:      <project>/electron/build/MyApp.app/Contents/MacOS/MyApp
```

Notes:

- The DMG flow requires **macOS** and `hdiutil` (bundled with macOS).
- Other artifacts (`.app`, `.AppImage`, `.deb`, `.exe`, `.msi`) use their own
  platform tools and do not need a DMG.
- The extracted bundle (`electron/build/`) is git-ignored and can be rebuilt any
  time by deleting the folder (`make clean-electron`).
- If you already have an extracted/installed bundle, set `ELECTRON_BINARY_PATH`
  to its executable to skip all package handling.

---

## Graceful First Launch

A packaged Electron app can take noticeably longer to boot on its first run
(especially right after extraction), and the window may only exist after the
renderer has started. To avoid flaky "element not found" failures, the launcher
does **not** use a fixed sleep. Instead it polls with the framework `recurse`
helper until the window is ready.

Automatic behaviour (inside fixtures):

- Polls `electronApp.firstWindow()` until a window exists
- Waits for the renderer's `domcontentloaded`
- Optionally accepts a readiness predicate
- Logs each attempt and the elapsed time; throws a descriptive error on timeout

You can wait explicitly on any Electron page object:

```typescript
const page = await electronPage.waitUntilReady();

// Or supply a custom readiness predicate and timeout
const page = await appPage.waitUntilReady({
  predicate: async (p) => (await p.title()).length > 0,
  timeoutMs: 120000,
  intervalMs: 3000,
});
```

---

## Fixtures & Page Objects

### Test Base

```typescript
// tests/baseElectronTest.ts
import { test, expect } from "../baseElectronTest.js";
```

### Core Fixtures (app-agnostic -- always available)

| Fixture | Type | Scope | Description |
|---------|------|-------|-------------|
| `electronApp` | `ElectronApplication` | worker | The launched app; closed on worker teardown |
| `electronPage` | `ElectronBasePage` | test | Base page object wrapping the main window |
| `appElectron` | `ElectronBasePage` | test | Alias for `electronPage` |
| `appReady` | `ElectronBasePage` | test | `electronPage` with `waitUntilReady()` applied |
| `electronPoManager` | `ElectronPOManager` | test | Generic registration-based Page Object Manager |

### Sample Fixtures (bundled "Pathao Resto" demo -- removable)

| Fixture | Type | Scope | Description |
|---------|------|-------|-------------|
| `pathaoApp` | `ElectronPathaoAppPage` | test | Demo app page object |
| `loginPage` | `ElectronLoginPage` | test | Demo login screen page object |
| `restoApp` | `ElectronPathaoAppPage` | test | Demo page object with the admin login ensured |

For a different app, replace these with your own fixtures or remove them - the
core fixtures above do not depend on them.

---

## Page Object Manager

Create a page object by extending `ElectronBasePage`:

```typescript
// src/ui/pages/myElectronPage.ts
import { ElectronBasePage } from "./electronBasePage.js";

export class MyElectronPage extends ElectronBasePage {
  async getTitle(): Promise<string> {
    return this.page.title();
  }
}
```

Register and retrieve it through the generic manager:

```typescript
test("example", async ({ electronPage, electronPoManager }) => {
  const appPage = electronPoManager.register("app", new MyElectronPage(electronPage.page));
  await appPage.waitUntilReady();

  const again = electronPoManager.get<MyElectronPage>("app");
  expect(await again.getTitle()).toBeTruthy();
});
```

API:

- `register<T>(name, page)` - registers a page object under a name and returns
  it. Automatically copies `app` / `appPath` from the owner so the main-process
  helpers work without extra wiring.
- `get<T>(name)` - returns the registered page object; throws when the name is
  unknown.
- `has(name)` - returns whether a name is registered.

### Main-Process Helpers

```typescript
// Run code in the Electron main process
const info = await appPage.mainProcess(({ app, BrowserWindow }) => ({
  version: app.getVersion(),
  name: app.getName(),
  windows: BrowserWindow.getAllWindows().length,
}));

// Number of open windows from the Playwright handle
const count = await appPage.windowCount();
```

---

## Screenshots

`ElectronBasePage` overrides `takeScreenshot()` to be self-sufficient for an
Electron window.

```typescript
await appPage.takeScreenshot("app-launch");             // -> screenshots/app-launch.png
await appPage.takeScreenshot("app-launch-session.png"); // explicit extension
```

Behaviour:

- Captures a full-page renderer screenshot of the main window
- Creates the `screenshots/` directory if missing
- Appends `.png` when the file name has no image extension
- Writes the PNG to `screenshots/<name>` (git-ignored)
- Attaches the image to the HTML and Allure report
- Logs the saved path

You can also capture the native window from the main process:

```typescript
const png: Buffer = await appPage.captureView(); // webContents.capturePage()
```

---

## Running Electron Tests

```bash
# Run only the Electron project
make test-electron

# With environment / repeat
make test-electron ENV=stage RCOUNT=3

# Equivalent direct command
npx playwright test --project=Electron
```

The Electron project lives in `playwright.config.ts` with `testDir: './tests/electron'`.

---

## Bring Your Own App

To point this framework at your **own** packaged Electron app:

1. **Provide the app** - copy `YourApp.dmg` (or `.app`, `.AppImage`, `.deb`,
   `.exe`, `.msi`) into `resources/`, or set `ELECTRON_BINARY_PATH` to an
   already installed binary
2. **Configure `.env.<env>`**
   - `ELECTRON_ENABLED=true`
   - `ELECTRON_DMG_PATH="resources/YourApp-1.0.0-universal.dmg"` or `ELECTRON_BINARY_PATH`
   - Raise `ELECTRON_LAUNCH_TIMEOUT` if your app is slow to boot
3. **Write a page object** extending `ElectronBasePage`, for example
   `src/ui/pages/yourAppPage.ts`.
4. **Expose it** one of two ways:
   - In-spec: `electronPoManager.register("app", new YourAppPage(page))`
   - Via fixture: add a fixture in `tests/baseElectronTest.ts` mirroring the
     sample `pathaoApp` fixture
5. **If login is required**: add a login page object (see
   `src/ui/pages/electronLoginPage.ts`) with your own selectors, and call its
   flow from your test or an "authenticated" fixture (see the sample `restoApp`).
6. **Remove the samples** when ready: delete the sample fixtures in
   `tests/baseElectronTest.ts`, the sample page objects, `tests/electron/login.spec.ts`,
   and (optionally) the demo artifact under `resources/`.

---

## Examples

### Example 1: Generic Smoke Launch

```typescript
import { test, expect } from "../baseElectronTest.js";

test.describe("Electron App Launch", () => {
  test("launches the packaged app and captures state", { tag: ["@ELECTRON", "@smoke"] }, async ({
    electronPage,
  }) => {
    const page = await electronPage.waitUntilReady();
    expect(page).toBeTruthy();

    await electronPage.waitForElementVisible("body", 15000);
    expect(electronPage.page.url().length).toBeGreaterThan(0);

    const info = await electronPage.mainProcess(({ app, BrowserWindow }) => ({
      name: app.getName(),
      version: app.getVersion(),
      openWindows: BrowserWindow.getAllWindows().length,
    }));
    expect(info.name.length).toBeGreaterThan(0);
    expect(info.openWindows).toBeGreaterThan(0);

    await electronPage.takeScreenshot("app-launch");

    try {
      const png = await electronPage.captureView();
      expect(png.byteLength).toBeGreaterThan(0);
    } catch {
      // Non-fatal: main-process capture may be unsupported in some builds.
    }
  });
});
```

This test is exactly `tests/electron/appLaunch.spec.ts` and runs against any
configured app.

### Example 2: App-specific page object via the manager

```typescript
import { test, expect } from "../baseElectronTest.js";
import { MyElectronPage } from "../src/ui/pages/myElectronPage.js";

test("my app flow", async ({ electronPage, electronPoManager }) => {
  const appPage = electronPoManager.register("app", new MyElectronPage(electronPage.page));
  await appPage.waitUntilReady();
  expect(await appPage.getTitle()).toBeTruthy();
});
```

### Example 3: Sample "Pathao Resto" demo flow

The bundled demo login lives in `tests/electron/login.spec.ts` and depends on
the sample fixtures plus `config.electron.auth` credentials. Use it as a
reference for building the equivalent flow for your own app.

---

## Troubleshooting

### Issue: "No Electron app configured"

**Cause:** both `ELECTRON_DMG_PATH` and `ELECTRON_BINARY_PATH` are empty.

**Solution:** set either variable to the packaged artifact or the installed
binary path.

### Issue: "Electron DMG not found"

**Cause:** `ELECTRON_DMG_PATH` does not point at an existing file.

**Solution:** place the artifact at the configured path (e.g. `resources/MyApp.dmg`)
or update the environment variable.

### Issue: "Electron testing is disabled"

**Cause:** `ELECTRON_ENABLED` is not `true`.

**Solution:** add `ELECTRON_ENABLED=true` to your `.env` file.

### Issue: Launch is slow on first run

Cold launches from a freshly extracted bundle can take a while.

**Solution:** the launcher polls instead of failing fast. Raise
`ELECTRON_LAUNCH_TIMEOUT`, or warm the bundle first: `make prepare-electron`.

### Issue: The wrong app or a stale build is launched

**Solution:** the cached bundle in `electron/build/` may be stale. Delete it with
`make clean-electron` and re-run; also confirm `ELECTRON_DMG_PATH` points at the
exact file you want (multiple builds are selected by this path).

### Issue: "unsupported mime type" when taking a screenshot

**Solution:** handled automatically - `takeScreenshot()` appends `.png` when the
file name has no image extension.

### Issue: No window / `firstWindow()` times out

**Solution:** check the app opens normally (manual double-click test), confirm
your readiness predicate matches the window title/URL, and verify the build is
not hardened against the debugging endpoints Playwright relies on.

### Issue: Main-process `captureView()` fails

**Solution:** wrap it in a try/catch (as the sample spec does) or rely on the
renderer-level `takeScreenshot()`.

### Issue: Windows resolver picks the wrong `.exe`

**Solution:** extraction prefers the top-level launcher, then `resources/app/`,
then a recursive scan. If your installer uses an unusual layout, extract it once
and set `ELECTRON_BINARY_PATH` to your launcher.

---

## Summary

| Area | Usage | Location |
|------|-------|----------|
| Resolve/extract package | `prepareElectronApp()` | `src/ui/electron/electronPackageResolver.ts` |
| Launch + graceful wait + close | `launchElectronApp()`, `waitForReadyWindow()` | `src/ui/electron/electronLauncher.ts` |
| Page object base | `ElectronBasePage` | `src/ui/pages/electronBasePage.ts` |
| Page object manager | `register()` / `get()` / `has()` | `src/ui/electron/electronPoManager.ts` |
| Fixtures | `electronApp`, `electronPage`, `appReady`, ... | `tests/baseElectronTest.ts` |
| Prepare bundle | `make prepare-electron` | Makefile |
| Run tests | `make test-electron` | Makefile |

---

[← Back to Main README](../README.md) | [Next: UI Testing →](./UI_TESTING.md)
