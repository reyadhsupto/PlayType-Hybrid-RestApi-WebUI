// src/sharedUtils/config.ts

import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fetchConsulConfig } from "./consulConfig.js"

export type DatabaseType = "postgres" | "mysql";

export type DatabaseSshConfig = {
  useSsh: boolean;
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  password?: string;
};

export type DatabaseConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
};

export type NamedDatabaseConfig = {
  type: DatabaseType;
  useSsh: boolean;
  connection: DatabaseConnectionConfig;
  ssh?: DatabaseSshConfig;
  poolMax?: number;
};

export type DatabaseConfig = {
  enabled: boolean;
  defaultPoolMax: number;
  connections: Record<string, NamedDatabaseConfig>;
};

export type ApiBaseUrlsConfig = {
  user: string;
  resto: string;
  driver: string;
};

//Determining environment (default :- 'stage')
const ENV = process.env.ENV || "stage";

//Loading appropriate .env file (e.g., .env.stage, .env.prod)
const envPath = path.resolve(process.cwd(), `.env.${ENV}`);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`Environment file ${envPath} not found. Using system environment variables.`);
}

// Default config (will be overridden if Consul is enabled)
/**
 * Parse JSON from an environment variable.
 *
 * @param rawValue - Raw environment string value
 * @param variableName - Variable name for error reporting
 * @returns Parsed JSON object or null when empty
 */
function parseJsonEnv<T>(rawValue: string | undefined, variableName: string): T | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error: any) {
    throw new Error(`Failed to parse ${variableName}: ${error.message}`);
  }
}

/**
 * Build a normalized database connection definition.
 *
 * @param key - Database alias used by tests
 * @param rawConfig - Raw configuration from env or Consul
 * @returns Normalized database config ready for runtime use
 */
function normalizeDatabaseConfig(key: string, rawConfig: any): NamedDatabaseConfig {
  const type = rawConfig?.type;
  if (type !== "postgres" && type !== "mysql") {
    throw new Error(`Database "${key}" must declare type "postgres" or "mysql"`);
  }

  const connection = rawConfig?.connection ?? {};
  const ssh = rawConfig?.ssh ?? {};
  const useSsh = Boolean(rawConfig?.useSsh);

  const normalizedConnection: DatabaseConnectionConfig = {
    host: connection.host || "",
    port: Number(connection.port) || (type === "postgres" ? 5432 : 3306),
    user: connection.user || "",
    password: connection.password || "",
    name: connection.name || "",
  };

  if (!normalizedConnection.host || !normalizedConnection.user || !normalizedConnection.name) {
    throw new Error(`Database "${key}" is missing required connection fields`);
  }

  const normalizedSsh: DatabaseSshConfig | undefined = useSsh
    ? {
        useSsh: true,
        host: ssh.host || "",
        port: Number(ssh.port) || 22,
        username: ssh.username || "",
        privateKeyPath: ssh.privateKeyPath || "",
        password: ssh.password,
      }
    : undefined;

  if (useSsh) {
    if (!normalizedSsh?.host || !normalizedSsh.username || !normalizedSsh.privateKeyPath) {
      throw new Error(`Database "${key}" has useSsh=true but SSH fields are incomplete`);
    }
  }

  return {
    type,
    useSsh,
    connection: normalizedConnection,
    ssh: normalizedSsh,
    poolMax: Number(rawConfig?.poolMax) || undefined,
  };
}

/**
 * Build a named database map from JSON config if available.
 *
 * @returns A map of named database configurations
 */
function loadNamedDatabases(): Record<string, NamedDatabaseConfig> {
  const rawConnections = parseJsonEnv<Record<string, any>>(process.env.DB_CONNECTIONS_JSON, "DB_CONNECTIONS_JSON");
  const connections: Record<string, NamedDatabaseConfig> = {};

  if (!rawConnections || Object.keys(rawConnections).length === 0) {
    return connections;
  }

  for (const [key, value] of Object.entries(rawConnections)) {
    connections[key] = normalizeDatabaseConfig(key, value);
  }

  return connections;
}

const config = {
  useConsul: false, // if false → uses .env only
  consulHost: "127.0.0.1",
  consulPort: 8500,
  consulPrefix: "ParcelQuest",
  setupUiAuth: false,

  headless: false,

  appName: "PlayType-Hybrid-RestApi-Webui",
  defaultTimeout: 30000,
  logLevel: "info",

  api_base_url: process.env.api_base_url || "",
  api_base_urls: {
    user: process.env.user_api_base_url || process.env.api_base_url || "",
    resto: process.env.resto_api_base_url || process.env.api_base_url || "",
    driver: process.env.driver_api_base_url || process.env.api_base_url || "",
  } as ApiBaseUrlsConfig,
  api_base_path: "/v1/me/foods",
  api_gateway_bearer_token: process.env.API_BEARER_TOKEN || "",
  user_bearer_token: "",
  driver_bearer_token: "",
  resto_bearer_token: "",
  dashboard_url: process.env.dashboard_url || "",
  dashboard_domain: process.env.domain || "",
  auth: { //auth json for UI
    key: process.env.AUTH_KEY,
    state : {
      "token": process.env.AUTH_TOKEN,
      "user": {
        "name": process.env.AUTH_USER_NAME,
        "email": process.env.AUTH_USER_EMAIL,
        "given_name": process.env.AUTH_GIVEN_NAME,
        "family_name": process.env.AUTH_FAMILY_NAME,
        "picture": process.env.AUTH_USER_PIC,
        "zones": [
          {
            "uid": "88ab651e6db62fb80b1f3a40ebd3d532",
            "name": "Bangladesh",
            "code": null
          }
        ],
        "selectedZone": {
          "uid": "88ab651e6db62fb80b1f3a40ebd3d532",
          "name": "Bangladesh",
          "code": null
        },
        "permissions": [
          "quest_template_add",
          "quest_delete",
          "view_completed_page",
          "export_driver_lists",
          "view_activation_page",
          "test_per",
          "quest_activate",
          "default_notification",
          "quest_edit",
          "view_activity_log"
        ],
        "quest_lock_time": "360"
      },
      "loggingIn": false
    }
  },
  db: {
    enabled: process.env.DB_ENABLED === "true",
    defaultPoolMax: Number(process.env.DB_POOL_MAX) || 10,
    connections: loadNamedDatabases(),
  } as DatabaseConfig,

  ENV,
};

export default config;
