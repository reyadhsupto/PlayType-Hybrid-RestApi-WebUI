/**
 * Custom Step Decorator for Playwright Test
 * 
 * @description
 * Provides a decorator to wrap test methods with test.step() for better reporting.
 * Supports parameter interpolation using {{paramName}} syntax.
 * Automatically shows class.method name prefix in all steps.
 * 
 * @example
 * // Basic step - shows "SignupRealWorld.fillForm" in report
 * @step()
 * async fillForm(username: string, email: string) { }
 * 
 * // With custom message - shows "SignupRealWorld.fillForm • Filling with user: john"
 * @step("Filling with user: {{username}}")
 * async fillForm(username: string, email: string) { }
 * 
 * // With object parameters
 * @step("Creating: {{user}}")
 * async createUser(user: { name: string; email: string }) { }
 * 
 * Usage:
 *   // NO import needed - use @step directly if BasePage is extended
 *   // The decorator is available globally via BasePage
 *   
 *   // Or import as needed:
 *   import { step } from '../../sharedUtils/stepDecorator.js';
 */

import { test } from '@playwright/test';

type Method<This, Args extends unknown[], Return> = (
  this: This,
  ...args: Args
) => Promise<Return>;

type MethodDecoratorContext<
  This,
  Args extends unknown[],
  Return,
> = ClassMethodDecoratorContext<This, Method<This, Args, Return>>;

/**
 * Extracts parameter names from a function signature.
 * 
 * @param fn - The function to extract parameters from
 * @returns Array of parameter names
 * 
 * @example
 * function example(username, email, options = {}) { }
 * extractParams(example) // ["username", "email", "options"]
 */
function extractParams(fn: Function): string[] {
  const fnStr = fn.toString();
  const argsMatch = fnStr.match(/\(([^)]*)\)/);

  if (!argsMatch?.[1]) return [];

  return argsMatch[1]
    .split(',')
    .map(param => param.trim())
    .filter(Boolean)
    .map(param => param.replace(/=.*$/, '').trim())
    .map(param => param.replace(/^\.\.\./, '').trim());
}

/**
 * Interpolates parameter values into a step message.
 * Replaces {{paramName}} placeholders with actual argument values.
 * 
 * @param message - Step message with {{paramName}} placeholders
 * @param fn - The decorated function
 * @param args - The actual arguments passed to the function
 * @returns Interpolated message string
 * 
 * @example
 * const message = "Logging in as {{username}} with password {{password}}";
 * const args = ["john_doe", "secret123"];
 * interpolateParams(message, loginFunc, args)
 * // Returns: "Logging in as john_doe with password secret123"
 */
function interpolateParams<Args extends unknown[]>(
  message: string,
  fn: Function,
  args: Args
): string {
  const paramNames = extractParams(fn);

  return message.replace(/\{\{(\w+)\}\}/g, (_, paramName) => {
    const index = paramNames.indexOf(paramName);
    if (index === -1 || index >= args.length) return `{{${paramName}}}`;

    const value = args[index];
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

/**
 * Step decorator for test methods.
 * Wraps method execution with test.step() for better test reporting.
 * 
 * @template This - The class context
 * @template Args - The method arguments
 * @template Return - The method return type
 * 
 * @param message - Optional step message with {{paramName}} interpolation
 * @returns Decorator function
 * 
 * @example
 * class LoginPage {
 *   @step("Filling login form")
 *   async fillLoginForm(username: string, password: string) {
 *     // Implementation
 *   }
 * 
 *   @step("Clicking login button")
 *   async clickLogin() {
 *     // Implementation
 *   }
 * }
 * 
 * @example
 * class UserAPI {
 *   @step("Creating user with email: {{email}}")
 *   async createUser(email: string, name: string) {
 *     // Implementation
 *   }
 * 
 *   @step("Deleting user {{userId}}")
 *   async deleteUser(userId: number) {
 *     // Implementation
 *   }
 * }
 * 
 * @example
 * class ComplexOperations {
 *   @step("Processing order: {{order}}")
 *   async processOrder(order: { id: string; total: number }) {
 *     // JSON stringifies the object
 *   }
 * }
 */
export function step<
  This extends { constructor: { name: string } },
  Args extends unknown[],
  Return,
>(message?: string) {
  return (
    value: Method<This, Args, Return>,
    context: MethodDecoratorContext<This, Args, Return>
  ) => {
    const target = value;
    const name = context.name ?? 'unknown';

    function replacementMethod(
      this: This,
      ...args: Args
    ): Promise<Return> {
      const className = this.constructor.name;
      const methodName = String(name);
      const classMethodName = `${className}.${methodName}`;
      
      let stepName: string;
      
      if (message) {
        // If custom message provided, interpolate params and add class.method prefix
        const interpolated = interpolateParams(message, target, args);
        stepName = `${interpolated} • [${classMethodName}]`;
      } else {
        // If no message, just use class.method name
        stepName = classMethodName;
      }

      return test.step(stepName, async () => {
        return await target.call(this, ...args);
      });
    }

    return replacementMethod as Method<This, Args, Return>;
  };
}

/**
 * Re-export for convenience - can be imported from BasePage
 */
export { step as default };
