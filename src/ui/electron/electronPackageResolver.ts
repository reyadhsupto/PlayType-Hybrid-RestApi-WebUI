// src/ui/electron/electronPackageResolver.ts

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import config from "../../sharedUtils/config.js";
import { logger } from "../../sharedUtils/logger.js";

const execFileAsync = promisify(execFile);

/**
 * Result of resolving a packaged Electron app on disk.
 *
 * @property appPath - Absolute path to the installed or extracted app bundle
 * @property binaryPath - Absolute path to the app executable
 * @property packagePath - Absolute path to the source package file
 * @property packageType - Detected package type used for resolution
 * @property installRoot - Temporary install/extract root when the package is not a direct bundle
 */
export interface ResolvedApp {
  appPath: string;
  binaryPath: string;
  packagePath: string;
  packageType: "dmg" | "app" | "exe" | "msi" | "deb" | "appimage" | "unknown";
  installRoot?: string;
}

/**
 * Run a child process and return its stdout.
 *
 * @param command - Executable to run
 * @param args - Arguments for the executable
 * @returns Command stdout
 */
async function exec(command: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync(command, args);
  if (stderr && stderr.trim()) {
    logger.debug(`[electron-package] ${command} stderr: ${stderr.trim()}`);
  }
  return stdout;
}

/**
 * Check whether a command exists on PATH.
 *
 * @param command - Candidate executable name
 * @returns True when the command can be resolved
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a file extension for package detection.
 *
 * @param filePath - Path to inspect
 * @returns Lowercased extension or empty string
 */
function getPackageExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Locate the executable binary inside a macOS `.app` bundle.
 *
 * @param appPath - Absolute path to the `.app` bundle
 * @returns Absolute path to the `Contents/MacOS/<name>` executable
 */
export function findMacosBinary(appPath: string): string {
  const macosDir = path.join(appPath, "Contents", "MacOS");
  if (!fs.existsSync(macosDir)) {
    throw new Error(`Electron bundle has no Contents/MacOS dir: ${appPath}`);
  }

  const entries = fs.readdirSync(macosDir).filter((entry) => !entry.startsWith("."));
  if (entries.length === 0) {
    throw new Error(`Electron bundle Contents/MacOS is empty: ${macosDir}`);
  }

  const executable = entries.find((entry) => {
    const fullPath = path.join(macosDir, entry);
    try {
      fs.accessSync(fullPath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

  return path.join(macosDir, executable || entries[0]!);
}

/**
 * Locate an executable inside a folder by looking for the most likely launcher.
 *
 * @param rootDir - Directory to search
 * @returns Absolute path to the first executable-looking file
 */
function findExecutableInDirectory(rootDir: string): string {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(rootDir, entry.name));

  const executable = candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

  if (executable) {
    return executable;
  }

  if (candidates.length > 0) {
    return candidates[0]!;
  }

  throw new Error(`No executable file found in ${rootDir}`);
}

/**
 * Resolve a Windows launcher from a known install root.
 *
 * No product-specific names are assumed. The launcher is located generically:
 * top-level `.exe` files first (the usual electron-builder/NSIS layout puts the
 * main executable at the install root), then `resources/app/`, then a recursive
 * scan as a final fallback.
 *
 * @param installRoot - Root directory containing the extracted app
 * @returns Absolute path to the launcher executable
 */
function resolveWindowsLauncher(installRoot: string): string {
  const topLevelExe = fs
    .readdirSync(installRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"))
    .map((entry) => path.join(installRoot, entry.name))
    .find((candidate) => fs.existsSync(candidate));
  if (topLevelExe) {
    return topLevelExe;
  }

  const appDir = path.join(installRoot, "resources", "app");
  if (fs.existsSync(appDir)) {
    const appExe = fs
      .readdirSync(appDir)
      .filter((name) => name.toLowerCase().endsWith(".exe"))
      .map((name) => path.join(appDir, name))
      .find((candidate) => fs.existsSync(candidate));
    if (appExe) {
      return appExe;
    }
  }

  const exeFiles = walkForFiles(installRoot, (file) => file.toLowerCase().endsWith(".exe"));
  if (exeFiles.length > 0) {
    return exeFiles[0]!;
  }

  throw new Error(`Could not locate a Windows launcher in ${installRoot}`);
}

/**
 * Walk a directory tree and collect matching file paths.
 *
 * @param rootDir - Directory to search
 * @param predicate - Filter applied to each file path
 * @returns Matching file paths
 */
function walkForFiles(rootDir: string, predicate: (filePath: string) => boolean): string[] {
  const results: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (predicate(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Resolve a package type from the configured artifact path.
 *
 * @param packagePath - Candidate packaged artifact path
 * @returns Resolved package metadata
 */
export function resolvePackagedArtifact(packagePath: string): ResolvedApp {
  const normalizedPath = path.resolve(packagePath);
  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Electron package not found: ${normalizedPath}`);
  }

  if (normalizedPath.endsWith(".app")) {
    return {
      appPath: normalizedPath,
      binaryPath: findMacosBinary(normalizedPath),
      packagePath: normalizedPath,
      packageType: "app",
    };
  }

  const ext = getPackageExtension(normalizedPath);
  if (ext === ".appimage") {
    return {
      appPath: normalizedPath,
      binaryPath: normalizedPath,
      packagePath: normalizedPath,
      packageType: "appimage",
    };
  }

  switch (ext) {
    case ".dmg":
      return { appPath: "", binaryPath: "", packagePath: normalizedPath, packageType: "dmg" };
    case ".exe":
      return { appPath: "", binaryPath: "", packagePath: normalizedPath, packageType: "exe" };
    case ".msi":
      return { appPath: "", binaryPath: "", packagePath: normalizedPath, packageType: "msi" };
    case ".deb":
      return { appPath: "", binaryPath: "", packagePath: normalizedPath, packageType: "deb" };
    default:
      return { appPath: "", binaryPath: "", packagePath: normalizedPath, packageType: "unknown" };
  }
}

/**
 * Mount a DMG, copy its `.app` bundle into the project, then unmount it.
 *
 * @param dmgPath - Absolute path to the DMG file
 * @param destDir - Absolute directory where the `.app` bundle will be copied
 * @returns Resolved app bundle metadata
 */
async function extractFromDmg(dmgPath: string, destDir: string): Promise<ResolvedApp> {
  const attachOutput = await exec("hdiutil", ["attach", "-nobrowse", "-plist", dmgPath]);
  const mountPoints = [...attachOutput.matchAll(/<string>(\/Volumes\/[^<]+)<\/string>/g)].map(
    (match) => match[1]!
  );
  if (mountPoints.length === 0) {
    throw new Error(`Could not determine DMG mount point for: ${dmgPath}`);
  }
  const mountPoint = mountPoints[mountPoints.length - 1]!;

  try {
    const appNames = fs.readdirSync(mountPoint).filter((entry) => entry.endsWith(".app"));
    if (appNames.length === 0) {
      throw new Error(`No .app bundle found inside mounted volume: ${mountPoint}`);
    }

    const srcApp = path.join(mountPoint, appNames[0]!);
    const destApp = path.join(destDir, path.basename(srcApp));
    fs.mkdirSync(destDir, { recursive: true });
    logger.info(`[electron-package] Copying ${srcApp} -> ${destApp}`);
    await exec("ditto", [srcApp, destApp]);

    return {
      appPath: destApp,
      binaryPath: findMacosBinary(destApp),
      packagePath: dmgPath,
      packageType: "dmg",
    };
  } finally {
    try {
      await exec("hdiutil", ["detach", mountPoint]);
      logger.info(`[electron-package] Detached volume: ${mountPoint}`);
    } catch (error) {
      logger.warn(`[electron-package] Failed to detach volume ${mountPoint}: ${String(error)}`);
    }
  }
}

/**
 * Extract a Debian package to a temp directory and resolve the app binary.
 *
 * @param debPath - Absolute path to the Debian package
 * @returns Resolved app bundle metadata
 */
async function extractFromDeb(debPath: string): Promise<ResolvedApp> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "playtype-electron-deb-"));
  const appRoot = path.join(tempDir, "app");
  fs.mkdirSync(appRoot, { recursive: true });

  if (await commandExists("dpkg-deb")) {
    logger.info(`[electron-package] Extracting Debian package into ${appRoot}`);
    await exec("dpkg-deb", ["-x", debPath, appRoot]);
  } else {
    throw new Error(
      "dpkg-deb was not found on PATH. Install dpkg-deb to extract .deb packages for Electron tests."
    );
  }

  const binDir = path.join(appRoot, "usr", "bin");
  const optDir = path.join(appRoot, "opt");
  let binaryPath = "";

  if (fs.existsSync(binDir)) {
    binaryPath = findExecutableInDirectory(binDir);
  } else if (fs.existsSync(optDir)) {
    const optEntries = fs.readdirSync(optDir);
    for (const entry of optEntries) {
      const entryPath = path.join(optDir, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        try {
          binaryPath = findExecutableInDirectory(entryPath);
          break;
        } catch {
          continue;
        }
      }
    }
  }

  if (!binaryPath) {
    throw new Error(`Could not locate an executable inside extracted Debian package: ${debPath}`);
  }

  return {
    appPath: appRoot,
    binaryPath,
    packagePath: debPath,
    packageType: "deb",
    installRoot: tempDir,
  };
}

/**
 * Extract a Windows installer into a temp directory and resolve the launcher.
 *
 * This uses best-effort extraction helpers rather than assuming a specific
 * installer UX. If an extraction tool is unavailable, a clear error is raised.
 *
 * @param packagePath - Absolute path to the Windows installer
 * @param kind - Installer kind
 * @returns Resolved app metadata
 */
async function extractFromWindowsInstaller(
  packagePath: string,
  kind: "exe" | "msi"
): Promise<ResolvedApp> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "playtype-electron-win-"));
  const installRoot = path.join(tempDir, "app");
  fs.mkdirSync(installRoot, { recursive: true });

  if (await commandExists("7z")) {
    logger.info(`[electron-package] Extracting ${kind.toUpperCase()} package into ${installRoot}`);
    await exec("7z", ["x", packagePath, `-o${installRoot}`, "-y"]);
  } else if (await commandExists("bsdtar")) {
    logger.info(`[electron-package] Extracting ${kind.toUpperCase()} package with bsdtar into ${installRoot}`);
    await exec("bsdtar", ["-xf", packagePath, "-C", installRoot]);
  } else {
    throw new Error(
      `No extraction tool found for Windows package ${packagePath}. Install 7z or bsdtar to extract it.`
    );
  }

  const binaryPath = resolveWindowsLauncher(installRoot);

  return {
    appPath: installRoot,
    binaryPath,
    packagePath,
    packageType: kind,
    installRoot: tempDir,
  };
}

/**
 * Prepare a packaged Electron app for launch.
 *
 * This is the platform-aware entry point used by the test harness.
 *
 * @returns The resolved app bundle, ready to be launched
 */
export async function prepareElectronApp(): Promise<ResolvedApp> {
  // An explicit binary path bypasses package resolution entirely. This is the
  // simplest way to point the harness at an already installed or extracted app.
  const explicitBinary = config.electron.binaryPath.trim();
  if (explicitBinary) {
    const binaryPath = path.resolve(process.cwd(), explicitBinary);
    if (!fs.existsSync(binaryPath)) {
      throw new Error(
        `ELECTRON_BINARY_PATH does not exist: ${binaryPath}. Point it at the actual app executable.`
      );
    }
    logger.info(`[electron-package] Using explicit binary: ${binaryPath}`);
    return {
      appPath: path.dirname(binaryPath),
      binaryPath,
      packagePath: binaryPath,
      packageType: "unknown",
    };
  }

  const configuredPath = config.electron.dmgPath.trim();
  if (!configuredPath) {
    throw new Error(
      "No Electron app configured. Set ELECTRON_DMG_PATH to a packaged artifact " +
        "(.app, .dmg, .AppImage, .deb, .exe, .msi) or ELECTRON_BINARY_PATH to an " +
        "installed executable in your .env file."
    );
  }

  const packagePath = path.resolve(process.cwd(), configuredPath);
  const resolved = resolvePackagedArtifact(packagePath);
  const cachedBundleDir = path.resolve(process.cwd(), config.electron.appBundleDir);

  switch (resolved.packageType) {
    case "app":
      logger.info(`[electron-package] Using packaged app bundle directly: ${resolved.appPath}`);
      return resolved;

    case "dmg":
      if (fs.existsSync(cachedBundleDir)) {
        const existingApps = fs.readdirSync(cachedBundleDir).filter((entry) => entry.endsWith(".app"));
        if (existingApps.length > 0) {
          const appPath = path.join(cachedBundleDir, existingApps[0]!);
          const binaryPath = findMacosBinary(appPath);
          logger.info(`[electron-package] Reusing cached Electron bundle: ${appPath}`);
          return { appPath, binaryPath, packagePath, packageType: "dmg" };
        }
      }
      return extractFromDmg(packagePath, cachedBundleDir);

    case "appimage":
      logger.info(`[electron-package] Using AppImage directly: ${resolved.appPath}`);
      if (resolved.binaryPath && !fs.existsSync(resolved.binaryPath)) {
        throw new Error(`AppImage not found: ${resolved.binaryPath}`);
      }
      if (fs.existsSync(resolved.appPath)) {
        fs.chmodSync(resolved.appPath, 0o755);
      }
      return resolved;

    case "deb":
      return extractFromDeb(packagePath);

    case "exe":
    case "msi":
      return extractFromWindowsInstaller(packagePath, resolved.packageType);

    default:
      throw new Error(
        `Unsupported Electron package type for ${packagePath}. Expected .app, .dmg, .AppImage, .deb, .exe, or .msi.`
      );
  }
}
