// src/api/client.ts

import { APIRequestContext, APIResponse } from "@playwright/test";
import { logger } from "../sharedUtils/logger.js";

/**
 * ApiRequestOptions defines allowed inputs for an API request.
 * - `path_param` must include the endpoint path. It can start with "/" or not.
 * - `method` is restricted to HTTP verbs used in REST.
 * - `headers` allows passing custom request headers.
 * - `query_params` supports string, URLSearchParams, or key/value object formats.
 * - `payload` is the request body; accepts JSON (object) or raw string.
 */
export interface ApiRequestOptions {
  path_param: string; // e.g. "/posts"
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query_params?: string | URLSearchParams | Record<string, string | number | boolean>;
  payload?: object | string; // JSON or raw body
}

/**
 * ApiClient wraps Playwright's APIRequestContext to simplify API calls.
 * - Injected with base URL and request context instance from Playwright.
 * - Automatically handles:
 *    - Query params (string, object, or URLSearchParams)
 *    - JSON serialization
 *    - Logging request/response to console/log file
 *    - Ensuring correct path formatting
 *
 * Usage example:
 * ```
 * const apiClient = new ApiClient(request, "https://api.example.com");
 *
 * const response = await apiClient.callApi({
 *   path_param: "/v1/users",
 *   method: "POST",
 *   payload: { name: "john" }
 * });
 *
 * expect(response.status()).toBe(201);
 * ```
 */
export class ApiClient {
  constructor(private requestContext: APIRequestContext, private baseUrl: string) {}

  /**
   * Executes an HTTP API call using Playwright request context.
   *
   * @param options - Configuration object containing:
   *   - path_param: API path (with or without `/`)
   *   - method: HTTP method (GET, POST, PUT, PATCH, DELETE)
   *   - headers: (optional) additional headers
   *   - query_params: (optional) query parameters
   *   - payload: (optional) request body (for POST / PUT / PATCH)
   *
   * @returns Promise<APIResponse>
   * - Caller can extract JSON using `await response.json()`
   */
  async callApi(options: ApiRequestOptions): Promise<APIResponse> {
    const path_param = options.path_param.startsWith("/")
      ? options.path_param
      : `/${options.path_param}`;

    let queryString = "";
    if (options.query_params) {
      if (typeof options.query_params === "string") {
        queryString = `?${options.query_params}`;
      } else if (options.query_params instanceof URLSearchParams) {
        queryString = `?${options.query_params.toString()}`;
      } else {
        queryString = `?${new URLSearchParams(
          Object.entries(options.query_params).map(([k, v]) => [k, String(v)])
        ).toString()}`;
      }
    }

    const endpoint = `${this.baseUrl}${path_param}${queryString}`;

    // Logging request
    logger.info(`Api Endpoint: ${options.method.toUpperCase()} - ${endpoint}`);
    if (options.headers) {
      logger.debug(`Request Headers: ${JSON.stringify(options.headers, null, 2)}`);
    }
    if (["POST", "PUT", "PATCH"].includes(options.method.toUpperCase()) && options.payload) {
      logger.debug(`Request Payload: ${JSON.stringify(options.payload, null, 2)}`);
    }

    // Making request
    try {
      const response = await this.requestContext.fetch(path_param, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        params: options.query_params,
        data: options.payload,
      });

      const responseBody = await response.json().catch(() => null);
      logger.info(`Response Status :-> ${response.status()}`);
      logger.debug(`Api Response:-> ${JSON.stringify(responseBody, null, 2)}`);

      return response;
    } catch (err) {
      logger.error(`Error calling API; Stacktrace :-> ${err}`);
      throw err;
    }
  }
}
