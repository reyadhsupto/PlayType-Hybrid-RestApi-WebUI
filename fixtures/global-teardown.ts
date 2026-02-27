import * as fs from 'fs';
import * as path from 'path';
import { time_now, runLogFile, masterLogFile } from '../src/sharedUtils/logger';

async function globalTeardown() {
  const runtimeConfigPath = path.join(process.cwd(), "runtime-config.json");
/**
 * Deletes the runtime-config.json after test execution(if available)
 * Otherwise logs not found in console
 */
  if (fs.existsSync(runtimeConfigPath)) {
    try {
      fs.unlinkSync(runtimeConfigPath);
      console.log("runtime-config.json deleted successfully after test run.");
    } catch (err) {
      console.warn("Failed to delete runtime-config.json:", err);
    }
  } else {
    console.log("No runtime-config.json found — nothing to clean up.");
  }


  const end = new Date();
  const duration = (end.getTime() - time_now.getTime()) / 1000;
  const footer = `===== Test Run Finished: ${end.toLocaleString()} | Duration: ${duration}s =====\n\n`;

  fs.appendFileSync(runLogFile, footer);
  fs.appendFileSync(masterLogFile, footer);
}

export default globalTeardown;
