// src/api/services/baseService.ts

import { APIResponse, test } from "@playwright/test";
import { ApiRequestOptions, DirectCallOptions, ApiClient } from "../client.js";
import { Validator } from "../validator.js";
import { logger } from "../../sharedUtils/logger.js";
import { step } from '../../sharedUtils/stepDecorator.js';
import { z } from "zod";

export { step };

/**
 * Assertion execution mode used by BaseService validation helpers.
 *
 * - hard: fail immediately
 * - soft: record and log the failure without throwing
 */
export type AssertionMode = "hard" | "soft";

/**
 * Common options shared by assertion helpers.
 *
 * @property {AssertionMode} mode - Hard or soft assertion behavior
 */
export type AssertionOptions = {
  mode?: AssertionMode;
};

/**
 * Captured soft assertion failure information.
 *
 * @property {string} title - Human-readable failure title
 * @property {Record<string, any>} details - Structured failure details
 */
type SoftAssertionFailure = {
  title: string;
  details: Record<string, any>;
};

/**
 * Base class for all API service endpoints.
 * Provides common functionality for API calls and response validation.
 * Uses dependency injection to avoid coupling with test infrastructure.
 * 
 * @abstract
 * @class BaseService
 * 
 * @property {string} basePath - Abstract property that must be implemented by child classes.
 *                               Defines the base path for service endpoints (e.g., "/api/v1").
 */
export abstract class BaseService {
  /**
   * Base path for API endpoints
   * @protected
   * @abstract
   * @type {string}
   * @description Must be implemented by child classes. Used for path concatenation in callApi.
   */
  protected abstract basePath: string;

  /**
   * ApiClient instance for making HTTP requests
   * @protected
   * @type {ApiClient}
   * @description Injected via constructor. Used for all API calls.
   */
  protected apiClient: ApiClient;

  /**
   * Logger instance for logging
   * @protected
   * @type {typeof logger}
   * @description Winston logger from logger.ts. Used for debug, info, warn, and error logging.
   */
  protected logger = logger;

  /**
   * Stores soft assertion failures collected during the current test.
   *
   * @protected
   * @type {SoftAssertionFailure[]}
   * @description Soft assertions log and continue, but keep their failure data here
   * so tests can decide when to surface them.
   */
  protected softAssertionFailures: SoftAssertionFailure[] = [];

  /**
   * Constructor - Initializes BaseService with dependencies
   * 
   * @constructor
   * @param {ApiClient} apiClient - API client for HTTP requests
   * 
   * @description
   * Uses dependency injection to avoid coupling with test infrastructure.
   * Validator is used as static utility class (not injected).
   */
  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Resolve the assertion mode with hard as the default.
   *
   * @param options - Optional assertion settings
   * @returns The resolved assertion mode
   */
  protected getAssertionMode(options?: AssertionOptions): AssertionMode {
    return options?.mode ?? "hard";
  }

  /**
   * Record a soft assertion failure for later inspection.
   *
   * @param title - Human-readable failure title
   * @param details - Structured failure details
   * @returns A promise that resolves after the report attachment is added
   */
  protected async recordSoftAssertionFailure(title: string, details: Record<string, any>): Promise<void> {
    this.softAssertionFailures.push({ title, details });
    await this.attachFailureDetailsToReport(title, details);
  }

  /**
   * Return the collected soft assertion failures for the current service instance.
   *
   * @returns A copy of the soft assertion failure list
   */
  public getSoftAssertionFailures(): SoftAssertionFailure[] {
    return [...this.softAssertionFailures];
  }

  /**
   * Clear all collected soft assertion failures.
   *
   * @returns A promise that resolves once the collector is reset
   */
  public async clearSoftAssertionFailures(): Promise<void> {
    this.softAssertionFailures = [];
  }

  /**
   * Fail the current test if any soft assertions were recorded.
   *
   * @param title - Optional failure title used in the report
   * @returns A promise that resolves when the check completes
   * @throws Error when one or more soft failures exist
   */
  public async assertNoSoftAssertionFailures(title: string = "Soft Assertion Failures Detected"): Promise<void> {
    if (this.softAssertionFailures.length === 0) {
      return;
    }

    const details = {
      "Soft Failure Count": this.softAssertionFailures.length,
      "Soft Failures": this.softAssertionFailures,
    };

    await this.attachFailureDetailsToReport(title, details);
    throw new Error(`${title}: ${this.softAssertionFailures.length}`);
  }

  /**
   * Handle a pass or fail result for hard and soft assertion modes.
   *
   * @param passed - Whether the assertion passed
   * @param title - Human-readable assertion title
   * @param details - Structured failure details
   * @param options - Optional assertion mode
   * @returns A promise that resolves when logging/reporting is done
   * @throws Error when mode is hard and the assertion fails
   */
  protected async handleAssertionResult(
    passed: boolean,
    title: string,
    details: Record<string, any>,
    options?: AssertionOptions
  ): Promise<void> {
    if (passed) {
      return;
    }

    const mode = this.getAssertionMode(options);
    this.logger.error(`[Assertion Failure: ${title}]`);

    if (mode === "soft") {
      this.logger.warn(`Soft assertion failed: ${title}`);
      await this.recordSoftAssertionFailure(title, details);
      return;
    }

    await this.attachFailureDetailsToReport(title, details);
    throw new Error(title);
  }

  /**
   * Validates database query results against schema or field value.
   * Returns early if no results (DB disabled or empty result set).
   * 
   * @method assertDbQueryResult
   * @async
   * @public
   * 
   * @param {any[]} queryResult - Array of database rows
 * @param {object | string} schemaOrField - JSON schema object or field path
 * @param {any} [expectedValue] - Expected value for field validation (optional)
 * @param {AssertionOptions} [options] - Assertion behavior(hard/soft), defaults to hard mode
   * 
   * @returns {Promise<void>} No return value
   * 
   * @throws {Error} Via expect() if validation fails
   * 
   * @description
   * Two validation modes:
   * 1. Schema validation: Pass object schema, validates entire result array
   * 2. Field validation: Pass field path string and expectedValue, validates first row
   * Uses Validator static methods for validation.
   */
  async assertDbQueryResult(
    queryResult: any[],
    schemaOrField: object | string,
    expectedValue?: any,
    options?: AssertionOptions
  ): Promise<void> {
    // Early return if no results (DB disabled or empty)
    if (Array.isArray(queryResult) && queryResult.length === 0) {
      this.logger.warn('DB query returned no results or DB is disabled.');
      return;
    }

    let passed = false;
    let title = "Database Assertion Failed";
    let details: Record<string, any> = {};

    if (typeof schemaOrField === 'object') {
      // Schema validation mode - uses static Validator method
      const isValid = Validator.validateSchema(schemaOrField, queryResult);
      passed = isValid;
      title = "Database Schema Assertion Failed";
      details = {
        "Expected Schema": schemaOrField,
        "Actual Result": queryResult,
      };
    } else if (typeof schemaOrField === 'string' && expectedValue !== undefined) {
      // Field validation mode - uses static Validator method
      const isValid = Validator.validateNestedFieldValue(queryResult[0], schemaOrField, expectedValue);
      passed = isValid;
      title = "Database Field Assertion Failed";
      details = {
        Field: schemaOrField,
        Expected: expectedValue,
        Actual: queryResult?.[0] ? Validator.getNestedValue(queryResult[0], schemaOrField) : undefined,
        "Full Result": queryResult,
      };
    }

    await this.handleAssertionResult(passed, title, details, options);
  }

  /**
   * Wrapper around apiClient.callApi for structured API calls.
   * Uses injected requestContext with baseURL.
   * Concatenates basePath with path_param for full endpoint path.
   * 
   * @method callApi
   * @async
   * @protected
   * 
   * @param {ApiRequestOptions} options - API request configuration
   * @param {string} options.path_param - Relative path to endpoint
   * @param {string} options.method - HTTP method
   * @param {Record<string, string>} [options.headers] - Optional headers
   * @param {string | URLSearchParams | Record} [options.query_params] - Optional query params
   * @param {object | string} [options.payload] - Optional request body
   * 
   * @returns {Promise<APIResponse>} Playwright APIResponse object
   * 
   * @description
   * Protected method - only accessible within service classes.
   * Tests should call public service methods (e.g., loginUser) instead.
   * Concatenates basePath + path_param for full endpoint path.
   */
  protected async callApi(options: ApiRequestOptions): Promise<APIResponse> {
    // Concatenate basePath with path_param
    const fullPath = options.path_param ? `${this.basePath}/${options.path_param}` : this.basePath;

    // Delegate to apiClient with full path
    return this.apiClient.callApi({
      path_param: fullPath,
      method: options.method,
      headers: options.headers,
      query_params: options.query_params,
      payload: options.payload,
    });
  }

  /**
   * Wrapper around apiClient.callDirectApi for one-off API calls.
   * Does NOT use baseURL - requires full URL.
   * Uses same requestContext as callApi (shares cookies, auth state).
   * 
   * @method callDirectApi
   * @async
   * @protected
   * 
   * @param {DirectCallOptions} options - Direct API call configuration
   * @param {string} options.url - Full URL including protocol and domain
   * @param {string} options.method - HTTP method
   * @param {Record<string, string>} [options.headers] - Optional headers
   * @param {string | URLSearchParams | Record} [options.query_params] - Optional query params
   * @param {object | string} [options.payload] - Optional request body
   * 
   * @returns {Promise<APIResponse>} Playwright APIResponse object
   * 
   * @description
   * Protected method - only accessible within service classes.
   * Useful for external APIs, webhooks, third-party services.
   * Delegates to apiClient.callDirectApi.
   */
  protected async callDirectApi(options: DirectCallOptions): Promise<APIResponse> {
    return this.apiClient.callDirectApi(options);
  }

  /**
   * Asserts & Logs that HTTP response status matches expected value.
   * 
   * @method assertStatus
   * @async
   * @public
   * 
   * @param {APIResponse} response - Playwright APIResponse to validate
 * @param {number} expectedStatus - Expected HTTP status code (e.g., 200, 404)
 * @param {AssertionOptions} [options] - Assertion behavior (hard/soft), defaults to hard mode
   * 
   * @returns {Promise<void>} No return value
   * 
   * @throws {Error} Via expect() if status doesn't match
   * 
   * @description
   * Public method - accessible from tests.
   * Uses Playwright's expect assertion.
   */
  async assertStatus(response: APIResponse, expectedStatus: number, options?: AssertionOptions): Promise<void> {
    const actualStatus = response.status();
    if (actualStatus === expectedStatus) {
      this.logger.info(`Response status ${actualStatus} matches with expected ${expectedStatus}`);
    }

    let responseBody: any = "Unable to parse response";
    try {
      responseBody = await response.json().catch(() => response.text().catch(() => "Unable to parse response"));
    } catch (error) {
      this.logger.warn(`Could not read response for reporting: ${error}`);
    }

    await this.handleAssertionResult(
      actualStatus === expectedStatus,
      "API Status Assertion Failed",
      {
        "Expected Status": expectedStatus,
        "Actual Status": actualStatus,
        "Response Headers": response.headers(),
        "Response Body": responseBody,
      },
      options
    );
  }

  /**
   * Validates JSON response body against JSON Schema using AJV.
   * 
   * @method validateSchema
   * @async
   * @public
   * 
   * @param {APIResponse} response - Playwright APIResponse to validate
 * @param {object} schema - JSON Schema object (Draft 7 compatible)
 * @param {AssertionOptions} [options] - Assertion behavior (hard/soft), defaults to hard mode
   * 
   * @returns {Promise<void>} No return value
   * 
   * @throws {Error} Via expect() if validation fails
   * 
   * @description
   * Public method - accessible from tests.
   * Parses response as JSON, validates against schema via static Validator.
   * Uses AJV internally for schema validation.
   */
  async validateSchema(response: APIResponse, schema: object, options?: AssertionOptions): Promise<void> {
    let body: any;
    
    try {
      body = await response.json();
    } catch (error) {
      this.logger.error(`Failed to parse response as JSON: ${error}`);
      this.logger.error(`Response text: ${await response.text()}`);
      throw error;
    }
    
    const isValid = Validator.validateSchema(schema, body);
    
    if (!isValid) {
      this.logger.error(`Schema validation failed`);
      this.logger.error(`Expected schema: ${JSON.stringify(schema, null, 2)}`);
      this.logger.error(`Actual response: ${JSON.stringify(body, null, 2)}`);
    }

    await this.handleAssertionResult(isValid, "JSON Schema Validation Failed", {
      "Expected Schema": schema,
      "Actual Response": body,
    }, options);
  }

  /**
   * Validates JSON response body against Zod schema.
   * 
   * @method validateZodSchema
   * @async
   * @public
   * 
   * @param {APIResponse} response - Playwright APIResponse to validate
 * @param {z.ZodTypeAny} zodSchema - Zod schema object
 * @param {AssertionOptions} [options] - Assertion behavior (hard/soft), defaults to hard mode
   * 
   * @returns {Promise<void>} No return value
   * 
   * @throws {Error} Via expect() if validation fails
   * 
   * @description
   * Public method - accessible from tests.
   * Parses response as JSON, validates against Zod schema via static Validator.
   * Provides better TypeScript integration than JSON Schema.
   */
  async validateZodSchema(response: APIResponse, zodSchema: z.ZodTypeAny, options?: AssertionOptions): Promise<void> {
    let responsebody: any;
    
    try {
      responsebody = await response.json();
    } catch (error) {
      this.logger.error(`Failed to parse response as JSON: ${error}`);
      throw error;
    }
    
    const isValid = Validator.validateZodSchema(zodSchema, responsebody);
    
    if (!isValid) {
      this.logger.error(`Zod schema validation failed`);
      this.logger.error(`Response body: ${JSON.stringify(responsebody, null, 2)}`);
    }

    await this.handleAssertionResult(isValid, "Zod Schema Validation Failed", {
      "Expected Schema": zodSchema,
      "Actual Response": responsebody,
    }, options);
  }

  /**
   * Validates specific field value in API response.
   * Handles both JSON and plain text responses.
   * 
   * @method validateField
   * @async
   * @public
   * 
   * @param {APIResponse} response - Playwright APIResponse to validate
 * @param {string} field - Field path to validate (e.g., "user.email" or "data[0].id")
 * @param {any} expectedValue - Expected value at the field path
 * @param {AssertionOptions} [options] - Assertion behavior (hard/soft), defaults to hard mode
   * 
   * @returns {Promise<void>} No return value
   * 
   * @throws {Error} Via expect() if validation fails
   * 
   * @description
   * Public method - accessible from tests.
   * Routes validation based on response type:
   * - JSON objects/arrays: Uses static Validator.validateNestedFieldValue (supports dot notation)
   * - Plain text/numbers: Uses static Validator.validateFieldValue (string comparison)
   * Logs mismatch details on failure using injected logger.
   */
  async validateField(response: APIResponse, field: string, expectedValue: any, options?: AssertionOptions): Promise<void> {
    let body: any;
    let isMatch = false;

    try {
      // Read response as text first
      const rawText = await response.text();
      
      try {
        // Try parsing as JSON
        body = JSON.parse(rawText);
      } catch {
        // Not JSON, keep as plain text
        body = rawText;
      }

      if (typeof body === "object" && body !== null) {
        // JSON object/array - uses static Validator method
        isMatch = Validator.validateNestedFieldValue(body, field, expectedValue);
      } else {
        // Plain text/number - uses static Validator method
        const actualValue = String(body).trim();
        const expected = String(expectedValue).trim();
        isMatch = Validator.validateFieldValue(body, field, expected);

        if (!isMatch) {
          this.logger.error(`[Plain Field] Field validation failed for: ${field}.\n Expected: ${expected} \n Actual: ${actualValue}\n`);
        }
      }

      if (!isMatch && typeof body === "object") {
        const actualValue = Validator.getNestedValue(body, field);
        this.logger.error(`[Nested Field] Field validation failed for: ${field}.\n Expected: ${expectedValue} \n Actual: ${actualValue}\n`);
        // this.logger.error(`Full response: ${JSON.stringify(body, null, 2)}`);
      }
      
      await this.handleAssertionResult(isMatch, "Field Validation Failed", {
        Field: field,
        Expected: expectedValue,
        Actual: typeof body === "object" && body !== null
          ? Validator.getNestedValue(body, field)
          : String(body).trim(),
        "Full Response": body,
      }, options);

    } catch (err) {
      this.logger.error(`Field validation error for "${field}": ${err}`);
      throw err;
    }
  }

  /**
   * Attaches detailed failure information to Playwright HTML reporter.
   * Does NOT log to terminal - only to reporter.
   * Call this from your assertion methods when they fail.
   * 
   * @protected
   * @method attachFailureDetailsToReport
   * @async
   * 
   * @param {string} title - Title of the failure (e.g., "API Status Mismatch", "Field Validation Failed")
   * @param {Record<string, any>} details - Key-value pairs of failure details to display
   * 
   * @returns {Promise<void>} No return value
   * 
   * @description
   * Creates formatted HTML attachment in Playwright report with failure details.
   * Useful for keeping terminal clean while providing comprehensive debugging info.
   * 
   * @example
   * // In assertStatus method:
   * if (actualStatus !== expectedStatus) {
   *   await this.attachFailureDetailsToReport("API Status Mismatch", {
   *     "Expected Status": expectedStatus,
   *     "Actual Status": actualStatus,
   *     "Response Headers": response.headers(),
   *     "Response Body": responseBody
   *   });
   * }
   * 
   * // In validateField method:
   * if (!isMatch) {
   *   await this.attachFailureDetailsToReport("Field Validation Failed", {
   *     "Field": field,
   *     "Expected": expectedValue,
   *     "Actual": actualValue,
   *     "Full Response": body
   *   });
   * }
   */
  protected async attachFailureDetailsToReport(title: string, details: Record<string, any>): Promise<void> {
    try {
      // Build JSON string for text attachment (simpler, no HTML rendering issues)
      const detailsText = Object.entries(details)
        .map(([key, value]) => {
          const displayValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          return `${key}:\n${displayValue}`;
        })
        .join('\n' + '='.repeat(80) + '\n');

      const reportText = `${title}\n${'='.repeat(80)}\n${detailsText}`;

      await test.info().attach(title, {
        body: reportText,
        contentType: "text/plain",
      });
    } catch (error) {
      this.logger.warn(`Could not attach failure details to report: ${error}`);
    }
  }
}
