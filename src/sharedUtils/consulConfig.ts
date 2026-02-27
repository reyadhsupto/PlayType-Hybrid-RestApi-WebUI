import fetch from "node-fetch";

/**
 * Fetch key/values from Consul folder (e.g., ParcelQuest)
 * Transforms raw KV response into JS object.
 */
export async function fetchConsulConfig(host: string, port: number, key: string): Promise<Record<string, any>> {
  try {
    const url = `http://${host}:${port}/v1/kv/${key}?raw`;
    console.log(`Fetching Consul config from: ${url}`);
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch Consul KV: ${res.status} ${res.statusText}`);
    }

    const rawText = await res.text();
    const configObj: Record<string, any> = {};

    rawText.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return;

      const keyName = trimmed.slice(0, eqIndex).trim();
      let value: any = trimmed.slice(eqIndex + 1).trim();

      // Remove quotes if present
      if (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Convert booleans and numbers
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (!isNaN(Number(value)) && value !== "") value = Number(value);

      configObj[keyName] = value;
    });

    return configObj;
  } catch (err) {
    console.error("Error fetching Consul config:", err);
    return {};
  }
}