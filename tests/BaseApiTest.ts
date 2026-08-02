// tests/BaseApiTest.ts

import { test as base, request, APIRequestContext } from "@playwright/test";
import * as allure from "allure-js-commons";
import * as fs from "fs";
import * as path from "path";

import { ApiClient } from "../src/api/client.js";
import { DataGenerator } from "../src/api/apiUtils/payloadGenerator.js";
import { realWorldService } from "../src/api/services/realWorld/realWorldEndpoints.js";
import { FoodApi } from "../src/api/services/realWorld/foodEndpoints.js";
import { Validator } from "../src/api/validator.js";
import { DatabaseService } from "../src/sharedUtils/dbClient.js";
import config from "../src/sharedUtils/config.js";
import { logger } from "../src/sharedUtils/logger.js";
import { polling as pollingHelpers, type PollingHelpers } from "../src/sharedUtils/recurse.js";

// Load config from Consul if enabled
let envConfig = config;
if(config.useConsul){
    const runtimeConfigPath = path.join(process.cwd(), "runtime-config.json");
    envConfig = JSON.parse(fs.readFileSync(runtimeConfigPath, "utf-8"));
}

/**
 * Shared database service for the current Playwright worker process.
 *
 * This instance is injected through the dbClient fixture and also exposed
 * through BaseTest.dbClient for backward compatibility.
 */
const sharedDbClient = new DatabaseService(envConfig);

type TestOptions = {
  userBaseUrl: string;
  restoBaseUrl: string;
  driverBaseUrl: string;
};

/**
 * Build the request headers used for API test contexts.
 *
 * @param extraHTTPHeaders - Per-test headers supplied via test options
 * @returns Final merged headers for request.newContext()
 */
function buildApiHeaders(extraHTTPHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHTTPHeaders,
  };

  if (config.api_gateway_bearer_token && !headers.Authorization) {
    const token = config.api_gateway_bearer_token.trim();
    headers.Authorization = token.toLowerCase().startsWith("bearer ")
      ? token
      : `Bearer ${token}`;
  }

  return headers;
}

/**
 * Resolve a service base URL with config fallback.
 *
 * @param candidate - Optional base URL from test options
 * @param fallback - Default base URL from configuration
 * @returns The first non empty base URL
 */
function resolveBaseUrl(candidate: string | undefined, fallback: string): string {
  return candidate?.trim() || fallback;
}

/**
 * Create a Playwright API request context for a specific service.
 *
 * @param serviceName - Human readable service label used in logs
 * @param baseURL - Base URL for the service
 * @param extraHTTPHeaders - Extra headers merged into the request context
 * @returns A configured Playwright API request context
 */
async function createServiceApiContext(
  serviceName: string,
  baseURL: string,
  extraHTTPHeaders: Record<string, string>
): Promise<APIRequestContext> {
  const mergedHeaders = buildApiHeaders(extraHTTPHeaders);
  BaseTest.logger.info(`Setting up ${serviceName} API context for: ${baseURL}`);
  BaseTest.logger.debug(`[${serviceName}] Headers: ${JSON.stringify(mergedHeaders, null, 2)}`);

  return request.newContext({
    baseURL,
    extraHTTPHeaders: mergedHeaders,
  });
}

/**
 * Fixtures provided to each test.
 * 
 * @interface TestFixtures
 * @property {APIRequestContext} apiContext - Playwright API request context (auto cleanup)
 * @property {APIRequestContext} userApiContext - User service API request context
 * @property {APIRequestContext} restoApiContext - Resto service API request context
 * @property {APIRequestContext} driverApiContext - Driver service API request context
 * @property {ApiClient} apiClient - Custom API client wrapper
 * @property {ApiClient} userApiClient - User service API client wrapper
 * @property {ApiClient} restoApiClient - Resto service API client wrapper
 * @property {ApiClient} driverApiClient - Driver service API client wrapper
 * @property {realWorldService} rwService - RealWorld API service example
 * @property {FoodApi} foodApi - Food API service example
 * @property {DatabaseService} dbClient - Worker-scoped database service
 * @property {PollingHelpers} polling - Polling helpers for async checks
 */
type TestFixtures = {
  apiContext: APIRequestContext;
  userApiContext: APIRequestContext;
  restoApiContext: APIRequestContext;
  driverApiContext: APIRequestContext;
  apiClient: ApiClient;
  userApiClient: ApiClient;
  restoApiClient: ApiClient;
  driverApiClient: ApiClient;
  rwService: realWorldService;
  foodApi: FoodApi;
  polling: PollingHelpers;
};

/**
 * Worker-scoped fixtures shared by all tests in a Playwright worker.
 *
 * @property {DatabaseService} dbClient - Worker-scoped database service
 */
type WorkerFixtures = {
  dbClient: DatabaseService;
};

/**
 * Extended Test with Options and Fixtures
 * 
 * @description
 * Provides:
 * - TestOptions: Configurable per test/file (baseURL, extraHTTPHeaders)
 * - TestFixtures: Injected dependencies (apiContext, apiClient, rwService, dbClient)
 * 
 * Usage:
 *   // Override baseURL and headers per test file
 *   test.use({
 *     baseURL: "https://api.github.com",
 *     extraHTTPHeaders: { "Authorization": "Bearer token123" }
 *   });
 * 
 *   test("example", async ({ rwService }) => {
 *     await rwService.loginUser(payload);
 *   });
 */
export const test = base.extend<TestOptions & TestFixtures, WorkerFixtures>({
  /**
   * Configurable base URL for the user service.
   *
   * @option userBaseUrl
   * @default config.api_base_urls.user
   */
  userBaseUrl: [config.api_base_urls.user, { option: true }],

  /**
   * Configurable base URL for the resto service.
   *
   * @option restoBaseUrl
   * @default config.api_base_urls.resto
   */
  restoBaseUrl: [config.api_base_urls.resto, { option: true }],

  /**
   * Configurable base URL for the driver service.
   *
   * @option driverBaseUrl
   * @default config.api_base_urls.driver
   */
  driverBaseUrl: [config.api_base_urls.driver, { option: true }],

  /**
   * Creates and manages Playwright API request context.
   * Uses baseURL and extraHTTPHeaders from test options.
   * Automatically disposed after each test.
   * 
   * @fixture apiContext
   * @scope test
   * 
   * @param {string} baseURL - Base URL from test options
   * @param {Record<string, string>} extraHTTPHeaders - Headers from test options
   * 
   * @returns {APIRequestContext} Configured request context
   */
  apiContext: async ({ baseURL, extraHTTPHeaders = {} }, use) => {
    const resolvedBaseURL = baseURL ?? config.api_base_url;
    const context = await createServiceApiContext("api", resolvedBaseURL, extraHTTPHeaders);

    await use(context);

    await context.dispose();
    BaseTest.logger.info("API request context disposed");
  },

  /**
   * Creates and manages the user service API request context.
   *
   * @fixture userApiContext
   * @scope test
   */
  userApiContext: async ({ userBaseUrl, extraHTTPHeaders = {} }, use) => {
    const resolvedBaseURL = resolveBaseUrl(userBaseUrl, config.api_base_urls.user);
    const context = await createServiceApiContext("user", resolvedBaseURL, extraHTTPHeaders);

    await use(context);

    await context.dispose();
    BaseTest.logger.info("User API request context disposed");
  },

  /**
   * Creates and manages the resto service API request context.
   *
   * @fixture restoApiContext
   * @scope test
   */
  restoApiContext: async ({ restoBaseUrl, extraHTTPHeaders = {} }, use) => {
    const resolvedBaseURL = resolveBaseUrl(restoBaseUrl, config.api_base_urls.resto);
    const context = await createServiceApiContext("resto", resolvedBaseURL, extraHTTPHeaders);

    await use(context);

    await context.dispose();
    BaseTest.logger.info("Resto API request context disposed");
  },

  /**
   * Creates and manages the driver service API request context.
   *
   * @fixture driverApiContext
   * @scope test
   */
  driverApiContext: async ({ driverBaseUrl, extraHTTPHeaders = {} }, use) => {
    const resolvedBaseURL = resolveBaseUrl(driverBaseUrl, config.api_base_urls.driver);
    const context = await createServiceApiContext("driver", resolvedBaseURL, extraHTTPHeaders);

    await use(context);

    await context.dispose();
    BaseTest.logger.info("Driver API request context disposed");
  },

  /**
   * Creates custom ApiClient wrapper around Playwright context.
   * Depends on apiContext fixture and baseURL option.
   * 
   * @fixture apiClient
   * @scope test
   * 
   * @param {APIRequestContext} apiContext - Request context from fixture
   * @param {string} baseURL - Base URL from test options
   * 
   * @returns {ApiClient} API client instance
   */
  apiClient: async ({ apiContext, baseURL }, use) => {
    const resolvedBaseURL = baseURL ?? config.api_base_url;
    const client = new ApiClient(apiContext, resolvedBaseURL);
    await use(client);
  },

  /**
   * Creates an API client bound to the user service request context.
   *
   * @fixture userApiClient
   * @scope test
   */
  userApiClient: async ({ userApiContext, userBaseUrl }, use) => {
    const resolvedBaseURL = resolveBaseUrl(userBaseUrl, config.api_base_urls.user);
    const client = new ApiClient(userApiContext, resolvedBaseURL);
    await use(client);
  },

  /**
   * Creates an API client bound to the resto service request context.
   *
   * @fixture restoApiClient
   * @scope test
   */
  restoApiClient: async ({ restoApiContext, restoBaseUrl }, use) => {
    const resolvedBaseURL = resolveBaseUrl(restoBaseUrl, config.api_base_urls.resto);
    const client = new ApiClient(restoApiContext, resolvedBaseURL);
    await use(client);
  },

  /**
   * Creates an API client bound to the driver service request context.
   *
   * @fixture driverApiClient
   * @scope test
   */
  driverApiClient: async ({ driverApiContext, driverBaseUrl }, use) => {
    const resolvedBaseURL = resolveBaseUrl(driverBaseUrl, config.api_base_urls.driver);
    const client = new ApiClient(driverApiContext, resolvedBaseURL);
    await use(client);
  },

  /**
   * Creates RealWorld API service instance.
   * Depends on apiClient fixture.
   * 
   * @fixture rwService
   * @scope test
   * 
   * @param {ApiClient} apiClient - API client from fixture
   * 
   * @returns {realWorldService} RealWorld service instance
   */
  rwService: async ({ apiClient }, use) => {
    const service = new realWorldService(apiClient, config.api_base_path);
    await use(service);
  },

  /**
   * Creates food API service instance.
   * Depends on apiClient fixture.
   * 
   * @fixture foodApi
   * @scope test
   * 
   * @param {ApiClient} apiClient - API client from fixture
   * 
   * @returns {FoodApi} Food API service instance
   */
  foodApi: async ({ apiClient }, use) => {
    const service = new FoodApi(apiClient, config.api_base_path);
    await use(service);
  },

  /**
   * Provides reusable polling helpers for asynchronous state checks.
   *
   * The helper is stateless, so the same implementation can be shared
   * across all tests in the worker.
   */
  polling: async ({}, use) => {
    await use(pollingHelpers);
  },

  /**
   * Creates a worker-scoped database client that owns pooled connections.
   *
   * The worker fixture keeps a shared service instance per worker, lazily
   * opens pools on first use, and closes only active resources on teardown.
   */
  dbClient: [async ({}, use) => {
    try {
      await use(sharedDbClient);
    } finally {
      await sharedDbClient.closeAll();
    }
  }, { scope: "worker" }],
});

export { expect } from "@playwright/test";

/** 
 * @class BaseTest
 * 
 * @description
 * Provides static access to:
 * - logger: Winston logger for test logging
 * - validator: Response validation utilities
 * - generator: Test data generation
 * - dbClient: Database operations
 * - polling: Polling utilities for eventual consistency checks
 * - config: Environment configuration
 * - allure: Test reporting
 */
export class BaseTest {
  /**
   * Winston logger instance
   * @static
   * @description Logs to console and files. Available as BaseTest.logger
   */
  static logger = logger;

  /**
   * Validator utility class
   * @static
   * @description Static utility for response validation. Available as BaseTest.validator
   */
  static validator = Validator;

  /**
   * Data generator utility
   * @static
   * @description Generates test data payloads. Available as BaseTest.generator
   */
  static generator = DataGenerator;

  /**
   * Environment configuration
   * @static
   * @description Configuration loaded from file or Consul. Available as BaseTest.config
   */
  static config = config;

  /**
   * Database service
   * @static
   * @description Database operations. Available as BaseTest.dbClient
   */
  static dbClient = sharedDbClient;

  /**
   * Polling helper bundle
   * @static
   * @description Polling utilities available as BaseTest.polling
   */
  static polling = pollingHelpers;

  /**
   * Allure reporting
   * @static
   * @description Test reporting. Available as BaseTest.allure
   */
  static allure = allure;

  /**
   * Logs test title for tracking and debugging.
   * 
   * @method logTestTitle
   * @static
   * 
   * @param {string} message - Message prefix
   * @param {string} testTitle - Test title from test.info().title
   * 
   * @returns {void} No return value
   */
  static logTestTitle(message: string, testTitle: string): void {
    const title = testTitle || "Unknown Test";
    this.logger.info(`${message} : [${title}]`);
  }
}
