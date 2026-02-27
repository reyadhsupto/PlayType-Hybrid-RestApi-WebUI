import * as fs from 'fs';
import * as path from 'path';
import config from "../src/sharedUtils/config.ts"
import {fetchConsulConfig} from "../src/sharedUtils/consulConfig.ts"

async function globalSetup() {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const runIdFile = path.join(logsDir, '.run-id.json');
  const runId = new Date().toLocaleString().replace(/[\/,: ]/g, '-');

  // save runId for workers
  fs.writeFileSync(runIdFile, JSON.stringify({ runId }));

  const header = `\n===== Test Run Started: ${new Date().toLocaleString()} =====\n`;
  const masterLogFile = path.join(logsDir, 'master.log');
  fs.appendFileSync(masterLogFile, header);

  console.log(`USE_CONSUL: ${config.useConsul}`);

  let mergedConfig = { ...config };

  if (config.useConsul) {
    console.log(`Attempting to fetch config from Consul (${config.consulHost}:${config.consulPort})...`);
    try {
      const consulValues = await fetchConsulConfig(config.consulHost, config.consulPort, config.consulPrefix);
      if (Object.keys(consulValues).length > 0) {
        mergedConfig = { ...mergedConfig, ...consulValues };
        console.log("Consul configuration loaded successfully.");
      } else {
        console.warn("Consul returned empty config — using .env fallback.");
      }
    } catch (err) {
      console.error("Failed to load Consul configuration. Falling back to .env:", err);
    }
    // Save merged config for test workers
    const runtimeConfigPath = path.join(process.cwd(), "runtime-config.json");
    fs.writeFileSync(runtimeConfigPath, JSON.stringify(mergedConfig, null, 2));

    console.log(`Merged config written to: ${runtimeConfigPath}`);
  } else {
    console.log("Using only .env configuration (Consul disabled).");
  }

}

export default globalSetup;
