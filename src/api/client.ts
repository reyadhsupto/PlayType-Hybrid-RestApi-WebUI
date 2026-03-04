// src/api/client.ts

import { APIRequestContext, APIResponse } from "@playwright/test";
import { logger } from "../sharedUtils/logger.js";

export interface ApiRequestOptions {
  path_param: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query_params?: string | URLSearchParams | Record<string, string | number | boolean>;
  payload?: object | string;
}

export type DirectCallOptions = Omit<ApiRequestOptions, 'path_param'> & {
  url: string;
};

export class ApiClient {
  constructor(private requestContext: APIRequestContext, private baseUrl: string) {}

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

    logger.info(`[Context] Api Endpoint: ${options.method.toUpperCase()} - ${endpoint}`);
    if (options.headers) {
      logger.debug(`Request Headers: ${JSON.stringify(options.headers, null, 2)}`);
    }
    if (["POST", "PUT", "PATCH"].includes(options.method.toUpperCase()) && options.payload) {
      logger.debug(`Request Payload: ${JSON.stringify(options.payload, null, 2)}`);
    }

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

  /**
   * Direct HTTP call - uses the SAME requestContext but ignores baseURL
   * Just like request.get(), request.post() etc. in Playwright tests
   */
  async callDirectApi(options: DirectCallOptions): Promise<APIResponse> {
    const { url, method, headers, query_params, payload } = options;

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

      // Use the requestContext's methods directly - just like request.get() in Playwright
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

      await this.logResponse(response);
      return response;
    } catch (err) {
      logger.error(`Direct ${method.toUpperCase()} failed: ${err}`);
      throw err;
    }
  }

  private async logResponse(response: APIResponse): Promise<void> {
    logger.info(`Response Status: ${response.status()}`);

    try {
      const responseBody = await response.json();
      logger.debug(`Response Body: ${JSON.stringify(responseBody, null, 2)}`);
    } catch {
      try {
        const responseText = await response.text();
        logger.debug(`Response Body (text): ${responseText}`);
      } catch {
        logger.debug(`Response Body: [Unable to parse]`);
      }
    }
  }
}