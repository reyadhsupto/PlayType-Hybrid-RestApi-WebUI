// tests/BaseApiTest.ts

import { test as base, request, APIRequestContext } from "@playwright/test";
import { ApiClient } from "../src/api/client.js";
import { DatabaseService } from "../src/sharedUtils/dbClient.js";
import { logger } from "../src/sharedUtils/logger.js";
import { Validator } from "../src/api/validator.js";
import { DataGenerator } from "../src/api/apiUtils/payloadGenerator.js";
import { realWorldService } from "../src/api/services/realWorld/realWorldEndpoints.js";
import config from "../src/sharedUtils/config.js";
import * as allure from "allure-js-commons";

import * as fs from 'fs';
import * as path from 'path';

// Load config from Consul if enabled
let envConfig = config;
if(config.useConsul){
    const runtimeConfigPath = path.join(process.cwd(), "runtime-config.json");
    envConfig = JSON.parse(fs.readFileSync(runtimeConfigPath, "utf-8"));
}

/**
 * Options that can be configured per test or test file.
 * 
 * @interface TestOptions
 * @property {string} baseURL - Base URL for API requests (default from config)
 * @property {Record<string, string>} extraHTTPHeaders - Additional HTTP headers
 */
type TestOptions = {
  baseUrl: string;
  extraHeaders: Record<string, string>;
};

/**
 * Fixtures provided to each test.
 * 
 * @interface TestFixtures
 * @property {APIRequestContext} apiContext - Playwright API request context (auto cleanup)
 * @property {ApiClient} apiClient - Custom API client wrapper
 * @property {realWorldService} rwService - RealWorld API service
 */
type TestFixtures = {
  apiContext: APIRequestContext;
  apiClient: ApiClient;
  rwService: realWorldService;
};

/**
 * Extended Test with Options and Fixtures
 * 
 * @description
 * Provides:
 * - TestOptions: Configurable per test/file (baseURL, extraHTTPHeaders)
 * - TestFixtures: Injected dependencies (apiContext, apiClient, rwService)
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
export const test = base.extend<TestOptions & TestFixtures>({
  /**
   * Configurable base URL for API requests.
   * Can be overridden using test.use() in test files.
   * 
   * @option baseURL
   * @default config.api_base_url
   * 
   * @description
   * Override in test file:
   *   test.use({ baseURL: "https://api.example.com" });
   */
  baseUrl: [config.api_base_url, { option: true }],

  /**
   * Additional HTTP headers to include in all requests.
   * Can be overridden using test.use() in test files.
   * 
   * @option extraHTTPHeaders
   * @default { "Content-Type": "application/json" }
   * 
   * @description
   * Override in test file:
   *   test.use({ 
   *     extraHTTPHeaders: { 
   *       "Authorization": "Bearer token",
   *       "X-Custom-Header": "value" 
   *     } 
   *   });
   */
  extraHeaders: [{ "Content-Type": "application/json" }, { option: true }],

  /**
   * apiContext Fixture
   * 
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
  apiContext: async ({ baseURL, extraHeaders }, use) => {
    const resolvedBaseURL = baseURL ?? config.api_base_url;
    console.log("-------resolved base url-------:", resolvedBaseURL);
    BaseTest.logger.info(`Setting up API context for: ${resolvedBaseURL}`);
    BaseTest.logger.debug(`Headers: ${JSON.stringify(extraHeaders, null, 2)}`);

    const context = await request.newContext({
      baseURL: resolvedBaseURL,
      extraHTTPHeaders: extraHeaders
    });

    await use(context);

    await context.dispose();
    BaseTest.logger.info("API request context disposed");
  },

  /**
   * apiClient Fixture
   * 
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
  static dbClient = DatabaseService;

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