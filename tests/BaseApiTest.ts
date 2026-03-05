// tests/BaseApiTest.ts

import { request, APIRequestContext } from "@playwright/test";
import { ApiClient } from "../src/api/client.js";
import { DatabaseService } from "../src/sharedUtils/dbClient.js";
import { logger, runLogFile } from "../src/sharedUtils/logger.js";
import { Validator } from "../src/api/validator.js";
import { DataGenerator } from "../src/api/apiUtils/payloadGenerator.js";
import { realWorldService } from "../src/api/services/realWorld/realWorldEndpoints.js";
import config from "../src/sharedUtils/config.js";
import * as allure from "allure-js-commons";

import * as fs from 'fs';
import * as path from 'path';

let envConfig = config;
if(config.useConsul){
    const runtimeConfigPath = path.join(process.cwd(), "runtime-config.json");
    envConfig = JSON.parse(fs.readFileSync(runtimeConfigPath, "utf-8"));
}

/**
 * Manages api test setup, teardown, and provides access to services and utilities.
 * 
 * @class BaseTest
 * 
 * @description
 * Provides static access to:
 * - API client and request context
 * - Service instances (with dependency injection)
 * - Utilities (logger, validator, generator)
 * - Database client
 * - Allure reporting
 */
export class BaseTest {
    /**
     * Playwright request context
     * @static
     * @type {APIRequestContext}
     * @description Created in setup(), disposed in teardown()
     */
    static requestContext: APIRequestContext;

    /**
     * API client instance
     * @static
     * @type {ApiClient}
     * @description Wraps requestContext for simplified API calls
     */
    static apiClient: ApiClient;

    /**
     * Winston logger instance
     * @static
     * @type {typeof logger}
     * @description Imported from logger.ts
     */
    static logger = logger;

    /**
     * Validator utility class
     * @static
     * @type {typeof Validator}
     * @description Static utility for response validation
     */
    static validator = Validator;

    /**
     * Data generator utility
     * @static
     * @type {typeof DataGenerator}
     * @description Generates test data payloads
     */
    static generator = DataGenerator;

    /**
     * Environment configuration
     * @static
     * @type {typeof config}
     * @description Loaded from config file or Consul
     */
    static env_config = config;

    /**
     * RealWorld API service instance
     * @static
     * @type {realWorldService}
     * @description Initialized in setup() with dependency injection
     */
    static rw: realWorldService;

    /**
     * Database service
     * @static
     * @type {typeof DatabaseService}
     * @description For database operations
     */
    static DbC = DatabaseService;

    /**
     * Allure reporting
     * @static
     * @type {typeof allure}
     * @description For test reporting
     */
    static allure = allure;

    /**
     * Initializes test infrastructure before test suite runs.
     * Creates request context, API client, and service instances.
     * Uses dependency injection to initialize services.
     * 
     * @method setup
     * @async
     * @static
     * 
     * @param {string} baseUrl - Base URL for API requests
     * @param {Record<string, string>} [headers] - Optional default headers
     * 
     * @returns {Promise<void>} No return value
     * 
     * @description
     * Workflow:
     * 1. Creates Playwright request context with baseURL
     * 2. Initializes ApiClient with context and baseURL
     * 3. Injects dependencies into service instances (apiClient, logger)
     * 4. Logs setup completion
     */
    static async setup(baseUrl: string, headers?: Record<string, string>): Promise<void> {
        // Create request context with baseURL
        this.requestContext = await request.newContext({ 
            baseURL: baseUrl,
            extraHTTPHeaders: {
                "Content-Type": "application/json",
                ...(headers ?? {})
            }
        });

        // Initialize API client
        this.apiClient = new ApiClient(this.requestContext, baseUrl);

        // Initialize services with dependency injection
        // Inject: apiClient, service basePath
        this.rw = new realWorldService(
            this.apiClient,
            config.api_base_path
        );

        this.logger.info("BaseTest setup: requestContext, apiClient, services completed");
    }

    /**
     * Cleans up test infrastructure after test suite completes.
     * Disposes request context and logs completion.
     * 
     * @method teardown
     * @async
     * @static
     * 
     * @returns {Promise<void>} No return value
     * 
     * @description
     * Workflow:
     * 1. Disposes Playwright request context
     * 2. Logs teardown completion
     * 3. Logs test run log file location
     */
    static async teardown(): Promise<void> {
        await this.requestContext?.dispose();
        this.logger.info("BaseTest teardown: requestContext dispose done");
        this.logger.info(`Test completed, logs at: ${runLogFile}\n\n`);
    }

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
     * 
     * @description
     * Formats and logs test title with message prefix.
     * Uses "Unknown Test" as fallback if title is not provided.
     */
    static logTestTitle(message: string, testTitle: string): void {
        const title = testTitle || "Unknown Test";
        this.logger.info(`${message} : [${title}]`);
    }
}