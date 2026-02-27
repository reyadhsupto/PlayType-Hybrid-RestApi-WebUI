// src/api/validator.js

import {Ajv, ValidateFunction} from 'ajv'
import { z} from "zod";
import {BaseTest} from "../../tests/BaseApiTest.js"


/**
 * Validator class to validate API responses using:
 *  - AJV (JSON Schema validation)
 *  - Zod (schema + runtime type validation)
 */
export class Validator {
  private static ajv = new Ajv({ allErrors: true, strict: false });

  /**
   * Validates an API response body against a JSON Schema (AJV)
   *
   * @param schema - JSON Schema object (Draft 7 or compatible)
   * @param responseBody - Actual API response body to validate
   * @returns boolean - true if valid, false if not
   *
   * Usage:
   *   Validator.validateSchema(schemaObject, apiResponse)
   */
  static validateSchema(schema: object, responseBody: unknown): boolean {
    const validate: ValidateFunction = this.ajv.compile(schema);
    const valid = validate(responseBody);

    if (!valid) {
      BaseTest.logger.debug(
        `Schema validation failed.\nExpected schema: ${JSON.stringify(
           schema, null, 2 
          )
        }\nErrors: ${this.ajv.errorsText(validate.errors)}`
      );
      return false;
    }

    BaseTest.logger.info("Response schema matches with Api response");
    return true;
  }


  /**
   * Validate a shallow field (single level) eg. data['message']
   * Uses === strict comparison
   */
  static validateFieldValue( responseBody: any , field: string, expectedvalue: unknown){ //string matching using ===
    if(responseBody[field] === expectedvalue){
        return true;
    }
    else return false;
  }


  /**
   * Validates an API response using Zod schema
   *
   * @param schema - Zod schema (ZodType)instance (z.object({...}))
   * @param responseBody - Actual API JSON response
   * @returns boolean - true if valid, false if not
   *
   * Usage:
   *   Validator.validateZodSchema(zUserSchema, apiResponse)
   *
   * Notes:
   *  - Throws ZERO exceptions. Test does not break on validation failure.
   *  - Logs detailed error for debugging.
   */
  static validateZodSchema(schema: z.ZodTypeAny, responseBody: unknown): boolean {
    const result = schema.safeParse(responseBody);

    if (!result.success) {
      const tree = z.treeifyError(result.error);
      BaseTest.logger.error(
        `Zod schema validation failed.\nErrors:\n${JSON.stringify(
          tree,
          null,
          2
        )}`
      );
      return false;
    }

    BaseTest.logger.info("Zod schema validation successful.");
    return true;
  }


  /**
   * Validate nested field using dot/bracket notation (e.g. "data.city[0].id")
   *   "result.user.profile.email"
   */
  static validateNestedFieldValue(responseBody: any, fieldPath: string, expectedValue: unknown): boolean {
    try {
      const actualValue = this.getNestedValue(responseBody, fieldPath);

      if (actualValue === expectedValue) {
        BaseTest.logger.info(`Field "${fieldPath}" matches expected value.`);
        return true;
      } else {
        BaseTest.logger.debug(
          `Field mismatch for "${fieldPath}". Expected: ${expectedValue}, Actual: ${actualValue}`
        );
        return false;
      }
    } catch (err) {
      BaseTest.logger.debug(`Failed to resolve field path "${fieldPath}": ${err}`);
      return false;
    }
  }

  /**
   * Retrieve nested property from object safely.
   * Supports dot notation and array indices.
   * Example:
   *   const obj = { data: { items: [{ id: 123 }] } };
   *   getNestedValue(obj, "data.items[0].id"); // returns 123
   */
  static getNestedValue(obj: any, path: string): any {
    try {
      return path
        .replace(/\[(\d+)\]/g, ".$1") // convert [0] to .0
        .split(".")
        .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    } catch {
      return undefined;
    }
  }
  
}