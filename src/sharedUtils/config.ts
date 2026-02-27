import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fetchConsulConfig } from "./consulConfig.js"

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
const config = {
  useConsul: false, // if false → uses .env only
  consulHost: "127.0.0.1",
  consulPort: 8500,
  consulPrefix: "ParcelQuest",

  headless: false,

  appName: "PlayType-Hybrid-RestApi-Webui",
  defaultTimeout: 30000,
  logLevel: "info",

  api_base_url: process.env.api_base_url || "",
  api_base_path: "/api",
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
    ssh: {
      useSsh: process.env.USE_SSH === "true",
      host: process.env.SSH_HOST || "",
      port: Number(process.env.SSH_PORT) || 22,
      username: process.env.SSH_USER || "",
      privateKeyPath: process.env.SSH_KEY_PATH || "",
    },
    pgsql:{
      host: process.env.PG_DB_HOST || "",
      port: Number(process.env.PG_DB_PORT) || 5432,
      user: process.env.DB_USER || "",
      password: process.env.DB_PASSWORD || "",
      name: process.env.PG_DB_NAME || "",
    },
    // MySQL specific config (optional, can use same as above if only one DB at a time)
    mysql: {
      host: process.env.MYS_DB_HOST || "",
      port: Number(process.env.MYS_DB_PORT) || 3306,
      user: process.env.DB_USER || "",
      password: process.env.DB_PASSWORD || "",
      name: process.env.MYS_DB_NAME || "",
    },
  },

  ENV,
};

export default config;
