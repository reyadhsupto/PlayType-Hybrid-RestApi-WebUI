// src/api/client.ts

import { APIRequestContext, APIResponse } from "@playwright/test";
import { logger } from "../sharedUtils/logger.js";

/**
 * ApiRequestOptions Interface
 * 
 * Defines the structure for API requests using the callApi method.
 * Used for structured API calls with baseURL concatenation.
 * 
 * @interface ApiRequestOptions
 * 
 * @property {string} path_param - Endpoint path relative to baseURL. Can start with "/" or not.
 * @property {string} method - HTTP method: GET, POST, PUT, PATCH, DELETE
 * @property {Record<string, string>} [headers] - Optional custom HTTP headers. Merged with default Content-Type.
 * @property {string | URLSearchParams | Record<string, string | number | boolean>} [query_params] - Optional query parameters in multiple formats
 * @property {object | string} [payload] - Optional request body. JSON object or raw string.
 */
export interface ApiRequestOptions {
  path_param: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query_params?: string | URLSearchParams | Record<string, string | number | boolean>;
  payload?: object | string;
}

/**
 * DirectCallOptions Type
 * 
 * Defines the structure for direct API calls without baseURL.
 * Extends ApiRequestOptions using Omit to replace 'path_param' with 'url'.
 * 
 * @type DirectCallOptions
 * 
 * @property {string} url - Full URL including protocol and domain (required)
 * @property {string} method - HTTP method: GET, POST, PUT, PATCH, DELETE
 * @property {Record<string, string>} [headers] - Optional custom HTTP headers
 * @property {string | URLSearchParams | Record<string, string | number | boolean>} [query_params] - Optional query parameters
 * @property {object | string} [payload] - Optional request body
 */
export type DirectCallOptions = Omit<ApiRequestOptions, 'path_param'> & {
  url: string;
};

/**
 * ApiClient Class
 * 
 * Wrapper around Playwright's APIRequestContext for simplified API testing.
 * Provides two modes:
 * 1. callApi() - Structured approach using baseURL for internal APIs
 * 2. callDirectApi() - Flexible approach with full URLs for external/one-off APIs
 * 
 * @class ApiClient
 * 
 * @constructor
 * @param {APIRequestContext} requestContext - Playwright request context from test setup
 * @param {string} baseUrl - Base URL for API endpoints (used only in callApi)
 */
export class ApiClient {
  /**
   * Playwright's APIRequestContext instance
   * @private
   * @type {APIRequestContext}
   * @description Used for making HTTP requests. Shared state with cookies and auth.
   */
  private requestContext: APIRequestContext;

  /**
   * Base URL for API endpoints
   * @private
   * @type {string}
   * @description Used in callApi for path concatenation. Not used in callDirectApi.
   */
  private baseUrl: string;

  /**
   * Constructor - Initializes ApiClient
   * 
   * @param {APIRequestContext} requestContext - Playwright request context
   * @param {string} baseUrl - Base URL for API
   */
  constructor(requestContext: APIRequestContext, baseUrl: string) {
    this.requestContext = requestContext;
    this.baseUrl = baseUrl;
  }

  /**
   * callApi Method
   * 
   * Executes HTTP API calls using requestContext with baseURL concatenation.
   * Structured approach for internal/main API endpoints.
   * 
   * @method callApi
   * @async
   * 
   * @param {ApiRequestOptions} options - API request configuration
   * @param {string} options.path_param - Relative path to endpoint
   * @param {string} options.method - HTTP method
   * @param {Record<string, string>} [options.headers] - Optional headers
   * @param {string | URLSearchParams | Record} [options.query_params] - Optional query params
   * @param {object | string} [options.payload] - Optional request body
   * 
   * @returns {Promise<APIResponse>} Playwright APIResponse with status(), json(), text(), headers()
   * 
   * @throws {Error} If API request fails
   * 
   * @description
   * Workflow:
   * 1. Normalizes path_param (adds leading slash if missing)
   * 2. Builds query string from query_params
   * 3. Concatenates baseUrl + path_param + queryString
   * 4. Logs request details
   * 5. Executes HTTP request via requestContext.fetch()
   * 6. Logs response
   * 7. Returns APIResponse
   */
  async callApi(options: ApiRequestOptions): Promise<APIResponse> {
    // Normalize path to start with "/"
    const path_param = options.path_param.startsWith("/")
      ? options.path_param
      : `/${options.path_param}`;

    // Build query string from query_params if provided
    let queryString = "";
    if (options.query_params) {
      if (typeof options.query_params === "string") {
        // String format: "key1=value1&key2=value2"
        queryString = `?${options.query_params}`;
      } else if (options.query_params instanceof URLSearchParams) {
        // URLSearchParams object
        queryString = `?${options.query_params.toString()}`;
      } else {
        // Plain object: { key1: "value1", key2: 123 }
        queryString = `?${new URLSearchParams(
          Object.entries(options.query_params).map(([k, v]) => [k, String(v)])
        ).toString()}`;
      }
    }

    // Construct full endpoint: baseUrl + path + query
    const endpoint = `${this.baseUrl}${path_param}${queryString}`;

    // Log request details
    logger.info(`[Context] Api Endpoint: ${options.method.toUpperCase()} - ${endpoint}`);
    if (options.headers) {
      logger.debug(`Request Headers: ${JSON.stringify(options.headers, null, 2)}`);
    }
    if (["POST", "PUT", "PATCH"].includes(options.method.toUpperCase()) && options.payload) {
      logger.debug(`Request Payload: ${JSON.stringify(options.payload, null, 2)}`);
    }

    try {
      // Execute HTTP request using requestContext
      const response = await this.requestContext.fetch(path_param, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        params: options.query_params,
        data: options.payload,
      });

      // Log response
      const responseBody = await response.json().catch(() => null);
      logger.info(`Response Status :-> ${response.status()}`);
      logger.debug(`Api Response:-> ${JSON.stringify(responseBody, null, 2)}`);

      return response;
    } catch (err) {
      // Log error and re-throw
      logger.error(`Error calling API; Stacktrace :-> ${err}`);
      throw err;
    }
  }

  /**
   * callDirectApi Method
   * 
   * Executes HTTP calls using full URLs without baseURL concatenation.
   * Flexible approach for external APIs and one-off calls.
   * Uses same requestContext but ignores baseURL.
   * 
   * @method callDirectApi
   * @async
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
   * @throws {Error} If request fails or unsupported method used
   * 
   * @description
   * Workflow:
   * 1. Logs request details (url, method, headers, params, payload)
   * 2. Routes to appropriate requestContext method based on HTTP verb:
   *    - GET: requestContext.get()
   *    - POST: requestContext.post()
   *    - PUT: requestContext.put()
   *    - PATCH: requestContext.patch()
   *    - DELETE: requestContext.delete()
   * 3. Logs response
   * 4. Returns APIResponse
   * 
   * Uses same requestContext as callApi (shares cookies, auth state).
   * Useful for external APIs, webhooks, third-party services.
   */
  async callDirectApi(options: DirectCallOptions): Promise<APIResponse> {
    // Extract options
    const { url, method, headers, query_params, payload } = options;

    // Log request details
    logger.info(`[One Off] Api Endpoint: ${method.toUpperCase()} -  ${url}`);
    if (headers) {
      logger.debug(`Request Headers: ${JSON.stringify(headers, null, 2)}`);
    }
    if (query_params) {
      logger.debug(`Query Params: ${JSON.stringify(query_params, null, 2)}`);
    }
    if (payload && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      logger.debug(` Request Payload: ${JSON.stringify(payload, null, 2)}`);
    }

    try {
      let response: APIResponse;

      // Route to appropriate HTTP method on requestContext
      switch (method.toUpperCase()) {
        case "GET":
          response = await this.requestContext.get(url, { 
            headers, 
            params: query_params 
          });
          break;
        case "POST":
          response = await this.requestContext.post(url, {
            headers: { "Content-Type": "application/json", ...(headers || {}) },
            params: query_params,
            data: payload,
          });
          break;
        case "PUT":
          response = await this.requestContext.put(url, {
            headers: { "Content-Type": "application/json", ...(headers || {}) },
            params: query_params,
            data: payload,
          });
          break;
        case "PATCH":
          response = await this.requestContext.patch(url, {
            headers: { "Content-Type": "application/json", ...(headers || {}) },
            params: query_params,
            data: payload,
          });
          break;
        case "DELETE":
          response = await this.requestContext.delete(url, { 
            headers, 
            params: query_params 
          });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      // Log response
      await this.logResponse(response);
      return response;
    } catch (err) {
      // Log error and re-throw
      logger.error(`Direct ${method.toUpperCase()} failed: ${err}`);
      throw err;
    }
  }

  /**
   * logResponse - Private Helper Method
   * 
   * Logs API response details for debugging.
   * Attempts JSON parsing first, falls back to text, then gives up gracefully.
   * 
   * @private
   * @method logResponse
   * @async
   * 
   * @param {APIResponse} response - Playwright APIResponse to log
   * 
   * @returns {Promise<void>} No return value
   * 
   * @description
   * Logging strategy:
   * 1. Logs HTTP status code
   * 2. Attempts JSON parsing and logs formatted body
   * 3. Falls back to text if JSON fails
   * 4. Logs "[Unable to parse]" if both fail
   */
  private async logResponse(response: APIResponse): Promise<void> {
    // Always log status
    logger.info(`Response Status: ${response.status()}`);

    try {
      // Try JSON parsing first
      const responseBody = await response.json();
      logger.debug(`Response Body: ${JSON.stringify(responseBody, null, 2)}`);
    } catch {
      // Not JSON, try text
      try {
        const responseText = await response.text();
        logger.debug(`Response Body (text): ${responseText}`);
      } catch {
        // Unable to parse
        logger.debug(`Response Body: [Unable to parse]`);
      }
    }
  }
}