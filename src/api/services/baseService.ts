// src/api/services/baseService.ts

import {BaseTest} from "../../../tests/BaseApiTest.js"
import { APIResponse, expect } from "@playwright/test";
import { ApiRequestOptions, DirectCallOptions } from "../client.js";
import { Validator } from "../validator.js";

import { z } from "zod";

export abstract class BaseService {
  /**
   * Asserts DB query result using Validator
   */
  async assertDbQueryResult(queryResult: any[], schemaOrField: object | string, expectedValue?: any) {
    if (Array.isArray(queryResult) && queryResult.length === 0) {
      BaseTest.logger.warning('DB query returned no results or DB is disabled.');
      return;
    }

    if (typeof schemaOrField === 'object') {
      const isValid = BaseTest.validator.validateSchema(schemaOrField, queryResult);
      expect(isValid).toBe(true);
    } else if (typeof schemaOrField === 'string' && expectedValue !== undefined) {
      const isValid = BaseTest.validator.validateNestedFieldValue(queryResult[0], schemaOrField, expectedValue);
      expect(isValid).toBe(true);
    }
  }
  
  protected abstract basePath: string;

  /**
   * Wrapper around apiClient.callApi (EXISTING METHOD)
   * Uses the injected requestContext with baseURL
   * Structured approach with basePath concatenation
   * 
   * Usage:
   *   return this.callApi({
   *     method: 'POST',
   *     path_param: 'users/login',
   *     payload: { ... }
   *   });
   *
   * @param options - ApiRequestOptions
   * @returns APIResponse
   */
  protected async callApi(options: ApiRequestOptions): Promise<APIResponse> {
    const fullPath = options.path_param ? `${this.basePath}/${options.path_param}` : this.basePath;

    return BaseTest.apiClient.callApi({
      path_param: fullPath,
      method: options.method,
      headers: options.headers,
      query_params: options.query_params,
      payload: options.payload,
    });
  }

  /**
   * Direct HTTP call using global request object (NEW METHOD)
   * Does NOT use baseURL - requires FULL URL
   * Creates fresh request context for standalone calls
   * 
   * Usage:
   *   // External API call
   *   return this.directCall({ 
   *     url: 'https://api.github.com/users/octocat', 
   *     method: 'GET' 
   *   });
   *   
   *   // POST with data
   *   return this.directCall({ 
   *     url: 'https://webhook.site/unique-id', 
   *     method: 'POST', 
   *     data: { event: 'test' } 
   *   });
   *   
   *   // With auth headers
   *   return this.directCall({ 
   *     url: 'https://api.example.com/protected', 
   *     method: 'GET',
   *     headers: { 'Authorization': 'Bearer token' }
   *   });
   *
   * @param options - DirectCallOptions (url [full URL required], method, headers, params, data)
   * @returns APIResponse
   */
  protected async callDirectApi(options: DirectCallOptions): Promise<APIResponse> {
    return BaseTest.apiClient.callDirectApi(options);
  }

  /**
   * Asserts that the response HTTP status matches the expected value.
   */
  async assertStatus(response: APIResponse, expectedStatus: number) {
    expect(response.status()).toBe(expectedStatus);
  }

  /**
   * Validates the JSON response body against a JSON Schema.
   */
  async validateSchema(response: APIResponse, schema: object) {
    const body = await response.json();
    const isValid = BaseTest.validator.validateSchema(schema, body);
    expect(isValid).toBe(true);
  }

  /**
   * Validates the JSON response body against a zod supported object(schema).
   */
  async validateZodSchema(response: APIResponse, zodSchema: z.ZodTypeAny) {
    const responsebody = await response.json();
    const isValid = BaseTest.validator.validateZodSchema(zodSchema, responsebody);
    expect(isValid).toBe(true);
  }

  /**
   * Validates a specific field/value in an API response.
   */
  async validateField(response: APIResponse, field: string, expectedValue: any) {
    let body: any;
    let isMatch = false;

    try {
      const rawText = await response.text();
      
      try {
        body = JSON.parse(rawText);
      } catch {
        body = rawText;
      }

      if (typeof body === "object" && body !== null) {
        isMatch = Validator.validateNestedFieldValue(body, field, expectedValue);
      } else {
        const actualValue = String(body).trim();
        const expected = String(expectedValue).trim();
        isMatch = Validator.validateFieldValue(body, field, expected);

        if (isMatch) {
          BaseTest.logger.info(`Plain text response matches expected value.`);
        } else {
          BaseTest.logger.debug(
            `Plain text response mismatch.\nExpected: ${expected}\nActual: ${actualValue}`
          );
        }
      }

      expect(isMatch).toBe(true);

    } catch (err) {
      BaseTest.logger.error(`Field validation failed for "${field}": ${err}`);
      throw err;
    }
  }
}