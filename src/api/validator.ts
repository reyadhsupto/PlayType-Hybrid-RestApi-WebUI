// src/api/validator.ts

import {Ajv, ValidateFunction} from 'ajv';
import { z} from "zod";
import { logger } from "../sharedUtils/logger.js";

/**
 * Validator Class
 * 
 * Static utility class for validating API responses.
 * Supports two validation approaches:
 * 1. AJV (JSON Schema validation)
 * 2. Zod (schema + runtime type validation)
 * 
 * @class Validator
 * 
 * @description
 * All methods are static - no instantiation required.
 * Uses logger from logger.ts for logging validation results.
 */
export class Validator {
  /**
   * AJV instance for JSON Schema validation
   * @private
   * @static
   * @type {Ajv}
   * @description Configured with allErrors and non-strict mode
   */
  private static ajv = new Ajv({ allErrors: true, strict: false });

  /**
   * validateSchema Method
   * 
   * Validates data against a JSON Schema using AJV.
   * 
   * @method validateSchema
   * @static
   * 
   * @param {object} schema - JSON Schema object (Draft 7 or compatible)
   * @param {unknown} responseBody - Data to validate
   * 
   * @returns {boolean} true if valid, false if validation fails
   * 
   * @description
   * Workflow:
   * 1. Compiles schema using AJV
   * 2. Validates responseBody against schema
   * 3. Logs validation result
   * 4. Returns boolean result
   * 
   * Does not throw exceptions - returns false on failure.
   */
  static validateSchema(schema: object, responseBody: unknown): boolean {
    const validate: ValidateFunction = this.ajv.compile(schema);
    const valid = validate(responseBody);

    if (!valid) {
      logger.debug(
        `Schema validation failed.\nExpected schema: ${JSON.stringify(
           schema, null, 2 
          )
        }\nErrors: ${this.ajv.errorsText(validate.errors)}`
      );
      return false;
    }

    logger.info("Response schema matches with Api response");
    return true;
  }

  /**
   * validateFieldValue Method
   * 
   * Validates a shallow field (single level) using strict equality.
   * 
   * @method validateFieldValue
   * @static
   * 
   * @param {any} responseBody - Response object containing the field
   * @param {string} field - Field name to validate
   * @param {unknown} expectedvalue - Expected value for comparison
   * 
   * @returns {boolean} true if field matches expected value, false otherwise
   * 
   * @description
   * Uses strict equality (===) for comparison.
   * Only works for top-level fields (e.g., data['message']).
   * For nested fields, use validateNestedFieldValue.
   */
  static validateFieldValue(responseBody: any, field: string, expectedvalue: unknown): boolean {
    if(responseBody[field] === expectedvalue){
        return true;
    }
    else return false;
  }

  /**
   * validateZodSchema Method
   * 
   * Validates data using Zod schema.
   * 
   * @method validateZodSchema
   * @static
   * 
   * @param {z.ZodTypeAny} schema - Zod schema instance (z.object({...}))
   * @param {unknown} responseBody - Data to validate
   * 
   * @returns {boolean} true if valid, false if validation fails
   * 
   * @description
   * Workflow:
   * 1. Uses schema.safeParse() for safe validation
   * 2. Logs detailed error tree if validation fails
   * 3. Returns boolean result
   * 
   * Does not throw exceptions - uses safeParse for error handling.
   * Provides detailed error messages via Zod's treeifyError.
   */
  static validateZodSchema(schema: z.ZodTypeAny, responseBody: unknown): boolean {
    const result = schema.safeParse(responseBody);

    if (!result.success) {
      const tree = z.treeifyError(result.error);
      logger.error(
        `Zod schema validation failed.\nErrors:\n${JSON.stringify(
          tree,
          null,
          2
        )}`
      );
      return false;
    }

    logger.info("Zod schema validation successful.");
    return true;
  }

  /**
   * validateNestedFieldValue Method
   * 
   * Validates nested field using dot/bracket notation.
   * 
   * @method validateNestedFieldValue
   * @static
   * 
   * @param {any} responseBody - Response object containing nested fields
   * @param {string} fieldPath - Dot notation path (e.g., "data.user.email" or "items[0].id")
   * @param {unknown} expectedValue - Expected value at the field path
   * 
   * @returns {boolean} true if field matches expected value, false otherwise
   * 
   * @description
   * Supports:
   * - Dot notation: "result.user.profile.email"
   * - Array indices: "data.items[0].id"
   * - Mixed: "users[0].addresses[1].city"
   * 
   * Uses getNestedValue helper to traverse object path.
   * Returns false if path cannot be resolved or value doesn't match.
   */
  static validateNestedFieldValue(responseBody: any, fieldPath: string, expectedValue: unknown): boolean {
    try {
      const actualValue = this.getNestedValue(responseBody, fieldPath);

      if (actualValue === expectedValue) {
        logger.info(`Field "${fieldPath}" matches expected value.`);
        return true;
      } else {
        logger.debug(
          `Field mismatch for "${fieldPath}". Expected: ${expectedValue}, Actual: ${actualValue}`
        );
        return false;
      }
    } catch (err) {
      logger.debug(`Failed to resolve field path "${fieldPath}": ${err}`);
      return false;
    }
  }

  /**
   * getNestedValue Method
   * 
   * Retrieves nested property from object using path notation.
   * 
   * @method getNestedValue
   * @static
   * @private
   * 
   * @param {any} obj - Object to traverse
   * @param {string} path - Dot/bracket notation path
   * 
   * @returns {any} Value at the path, or undefined if not found
   * 
   * @description
   * Converts bracket notation to dot notation: [0] → .0
   * Traverses object path using reduce.
   * Returns undefined if any part of path is undefined.
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