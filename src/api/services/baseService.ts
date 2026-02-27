// src/services/baseService.ts

import {BaseTest} from "../../../tests/BaseApiTest.js"
import { APIResponse, expect } from "@playwright/test";
import { ApiRequestOptions } from "../client.js";
import { Validator } from "../validator.js";

import { z } from "zod";

export abstract class BaseService {
  /**
   * Asserts DB query result using Validator
   * Usage:
   *   await this.assertDbQueryResult(queryResult, schemaOrField, expectedValue)
   *
   * @param queryResult - Array of DB rows
   * @param schemaOrField - JSON schema object or field path
   * @param expectedValue - Expected value for field (optional)
   */
  async assertDbQueryResult(queryResult: any[], schemaOrField: object | string, expectedValue?: any) {
    if (Array.isArray(queryResult) && queryResult.length === 0) {
      BaseTest.logger.warning('DB query returned no results or DB is disabled.');
      // Do not fail test, just log
      return;
    }

    if (typeof schemaOrField === 'object') {
      // Validate against schema
      const isValid = BaseTest.validator.validateSchema(schemaOrField, queryResult);
      expect(isValid).toBe(true);
    } else if (typeof schemaOrField === 'string' && expectedValue !== undefined) {
      // Validate field value in first row
      const isValid = BaseTest.validator.validateNestedFieldValue(queryResult[0], schemaOrField, expectedValue);
      expect(isValid).toBe(true);
    }
  }
  protected abstract basePath: string; //will be used such as {base_url}/basepath where basepath is v2/quests eg. https://quest.stageenv.xyz/v2/quests/completed?page=1&limit=20&vertical_id=3

  /**
   * wrapper around apiclient(call api)
   * Calls the respective api
   * 
   * Usage:
   *   through basetest.apiclient.callApi
   *
   * @param ApiRequestOptions - accepts an interface(options) eg. {method,paylaod,pathparam,queryparam,headers}
   * 
   * returns APIResponse
   */
  protected async callApi(
        options: ApiRequestOptions
    ): Promise<APIResponse> {
        const fullPath = options.path_param ? `${this.basePath}/${options.path_param}` : this.basePath;

        return BaseTest.apiClient.callApi({
            path_param: fullPath,
            method :options.method,
            headers :options.headers,
            query_params: options.query_params,
            payload :options.payload,
        });
  }

  /**
   * Asserts that the response HTTP status matches the expected value.
   *
   * Usage:
   *   await BaseTest.assertStatus(response, 200);
   *
   * @param response - APIResponse returned from Playwright request
   * @param expectedStatus - Expected HTTP status code (e.g., 200, 404)
   */
  async assertStatus(response: APIResponse, expectedStatus: number) {
    expect(response.status()).toBe(expectedStatus);
  }

  /**
   * Validates the JSON response body against a JSON Schema.
   *
   * Usage:
   *   await BaseTest.validateSchema(response, schemaObject);
   *
   * Notes:
   *   - Assumes response is JSON.
   *   - Uses Validator.validateSchema internally.
   *
   * @param response - APIResponse returned from Playwright request
   * @param schema - JSON Schema object to validate against
   */
  async validateSchema(response: APIResponse, schema: object) {
    const body = await response.json();
    const isValid = BaseTest.validator.validateSchema(schema, body);
    expect(isValid).toBe(true);
  }


  /**
   * Validates the JSON response body against a zod supported object(schema).
   *
   * Usage:
   *   await BaseTest.validateZodSchema(response, schemaObject);
   *
   * Notes:
   *   - Assumes response is JSON.
   *   - Uses Validator.validateZodSchema internally.
   *
   * @param response - APIResponse returned from Playwright request
   * @param schema - Zod schema object to validate against
   */
  async validateZodSchema(response: APIResponse, zodSchema: z.ZodTypeAny) {
    const responsebody = await response.json();
    const isValid = BaseTest.validator.validateZodSchema(zodSchema, responsebody);
    expect(isValid).toBe(true);
  }


  /**
   * Validates a specific field/value in an API response.
   * * This method routes validation based on response type:
   * - For JSON objects/arrays, it uses 'validator.validateNestedFieldValue'.
   * - For plain text/numeric responses, it performs a string comparison.
   * * @param response - APIResponse returned from Playwright request
   * @param field - Field path to validate (e.g., "status", "data.items[0].id")
   * Leave empty for plain text responses
   * @param expectedValue - Value expected at the given field
   */
  async validateField(response: APIResponse, field: string, expectedValue: any) {
    let body: any;
    let isMatch = false;

    try {
      const rawText = await response.text();
      
      // Try parsing JSON (object or array)
      try {
        body = JSON.parse(rawText);
      } catch {
        // Treating as plain text if not JSON
        body = rawText;
      }

      if (typeof body === "object" && body !== null) {
        // JSON OBJECT/ARRAY LOGIC 
        isMatch = Validator.validateNestedFieldValue(body, field, expectedValue);
      } else {
        // PLAIN TEXT/NUMBER LOGIC 
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

      // Hard assertion
      expect(isMatch).toBe(true);

    } catch (err) {
      // Log error, then rethrow to mark the test as failed
      BaseTest.logger.error(`Field validation failed for "${field}": ${err}`);
      throw err;
    }
  }

}