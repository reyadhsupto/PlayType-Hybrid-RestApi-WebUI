import config from "./config.js";
import { logger } from "./logger.js";

/**
 * Context passed to the polling logger for each attempt.
 *
 * @typeParam T - Value returned by the polling command
 */
export type PollAttemptContext<T> = {
  attempt: number;
  elapsedMs: number;
  timeoutMs: number;
  intervalMs: number;
  message: string;
  value?: T;
  error?: unknown;
  matched: boolean;
};

/**
 * Polling logger that can be disabled, replaced with a custom message,
 * or replaced with a callback that returns a log line.
 */
export type PollingLogOption<T> = boolean | string | ((context: PollAttemptContext<T>) => string | void);

/**
 * Options for the polling helper.
 *
 * @typeParam T - Value returned by the polling command
 */
export type PollingOptions<T> = {
  timeoutMs?: number;
  intervalMs?: number;
  message?: string;
  log?: PollingLogOption<T>;
};

/**
 * Sleep for the requested number of milliseconds.
 *
 * @param ms - Delay in milliseconds
 * @returns A promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert any value into a log friendly string.
 *
 * @param value - Value to serialize
 * @returns A safe string representation
 */
function describeValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  try {
    const serialized = JSON.stringify(
      value,
      (_key, currentValue) => (typeof currentValue === "bigint" ? currentValue.toString() : currentValue),
      2
    );

    if (!serialized) {
      return Object.prototype.toString.call(value);
    }

    return serialized;
  } catch {
    const ctorName = (value as { constructor?: { name?: string } })?.constructor?.name;
    return ctorName ? `[${ctorName}]` : Object.prototype.toString.call(value);
  }
}

/**
 * Resolve a nested value using dot and bracket notation.
 *
 * @typeParam T - Expected return type
 * @param value - Source object
 * @param path - Field path such as "data.user.email" or "items[0].id"
 * @returns The resolved value or undefined when the path cannot be found
 */
export function getNestedValue<T = unknown>(value: unknown, path: string): T | undefined {
  try {
    return path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .reduce<unknown>((current, key) => {
        if (current === null || current === undefined) {
          return undefined;
        }

        if (typeof current !== "object") {
          return undefined;
        }

        return (current as Record<string, unknown>)[key];
      }, value) as T | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Log one polling attempt using the shared framework logger.
 *
 * @typeParam T - Value returned by the polling command
 * @param context - Current polling attempt details
 * @param option - Log behavior configured by the caller
 * @returns Nothing
 */
function logAttempt<T>(context: PollAttemptContext<T>, option: PollingLogOption<T> | undefined): void {
  if (option === false) {
    return;
  }

  if (typeof option === "function") {
    const customLog = option(context);
    if (customLog) {
      logger.info(customLog);
    }
    return;
  }

  const label = typeof option === "string" ? option : context.message;
  const result = context.error
    ? `error=${describeValue(context.error)}`
    : `value=${describeValue(context.value)}`;

  logger.info(
    `[Polling] ${label} | attempt ${context.attempt} | elapsed ${context.elapsedMs}ms / ${context.timeoutMs}ms | ${result}`
  );
}

/**
 * Poll a command until a predicate returns true.
 *
 * This helper re-executes the command after every interval until the predicate
 * is satisfied or the timeout is reached.
 *
 * @typeParam T - Value returned by the polling command
 * @param command - Async operation to execute on every attempt
 * @param predicate - Returns true when the condition is satisfied
 * @param options - Polling timeout, interval, and logging behavior
 * @returns The first value that satisfies the predicate
 * @throws Error when the timeout is reached
 */
export async function recurse<T>(
  command: () => Promise<T>,
  predicate: (value: T) => boolean | Promise<boolean>,
  options: PollingOptions<T> = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? config.defaultTimeout;
  const intervalMs = options.intervalMs ?? 1000;
  const message = options.message ?? "Polling condition";
  const startedAt = Date.now();
  let attempt = 0;
  let lastValue: T | undefined;
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    const elapsedMs = Date.now() - startedAt;

    try {
      const value = await command();
      lastValue = value;
      const matched = await predicate(value);

      logAttempt<T>(
        {
          attempt,
          elapsedMs,
          timeoutMs,
          intervalMs,
          message,
          value,
          matched,
        },
        options.log
      );

      if (matched) {
        logger.info(`[Polling] ${message} succeeded after ${attempt} attempts in ${Date.now() - startedAt}ms`);
        return value;
      }
    } catch (error) {
      lastError = error;

      logAttempt<T>(
        {
          attempt,
          elapsedMs,
          timeoutMs,
          intervalMs,
          message,
          error,
          matched: false,
        },
        options.log
      );
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }

    await sleep(Math.min(intervalMs, remainingMs));
  }

  throw new Error(
    `[Polling] ${message} timed out after ${attempt} attempts and ${Date.now() - startedAt}ms. ` +
      `Last value: ${describeValue(lastValue)}. Last error: ${describeValue(lastError)}.`
  );
}

/**
 * Wait until an API response reaches the expected HTTP status.
 *
 * @typeParam T - Response type with a status() method
 * @param command - Async function that returns the response to inspect
 * @param expectedStatus - HTTP status to wait for
 * @param options - Polling timeout, interval, and logging behavior
 * @returns The response that matched the expected status
 */
export async function waitForResponseStatus<T extends { status: () => number }>(
  command: () => Promise<T>,
  expectedStatus: number,
  options: PollingOptions<T> = {}
): Promise<T> {
  const message = options.message ?? `Waiting for response status ${expectedStatus}`;

  return recurse(
    command,
    (response) => response.status() === expectedStatus,
    {
      ...options,
      message,
      log:
        options.log ??
        ((context) => {
          if (context.error) {
            return `[Polling] ${message} | attempt ${context.attempt} | error=${describeValue(context.error)} | elapsed ${context.elapsedMs}ms / ${context.timeoutMs}ms`;
          }

          const currentStatus = context.value ? context.value.status() : "unknown";
          return `[Polling] ${message} | attempt ${context.attempt} | status=${currentStatus} | elapsed ${context.elapsedMs}ms / ${context.timeoutMs}ms`;
        }),
    }
  );
}

/**
 * Wait until a nested field reaches the expected value.
 *
 * @typeParam T - Object type returned by the polling command
 * @param command - Async function that returns the object to inspect
 * @param fieldPath - Dot or bracket notation path to the field
 * @param expectedValue - Value to wait for
 * @param options - Polling timeout, interval, and logging behavior
 * @returns The object that matched the expected field value
 */
export async function waitForResponseFieldValue<T extends Record<string, unknown>>(
  command: () => Promise<T>,
  fieldPath: string,
  expectedValue: unknown,
  options: PollingOptions<T> = {}
): Promise<T> {
  const message = options.message ?? `Waiting for field ${fieldPath} to match expected value`;

  return recurse(
    command,
    (response) => getNestedValue(response, fieldPath) === expectedValue,
    {
      ...options,
      message,
      log:
        options.log ??
        ((context) => {
          if (context.error) {
            return `[Polling] ${message} | attempt ${context.attempt} | error=${describeValue(context.error)} | elapsed ${context.elapsedMs}ms / ${context.timeoutMs}ms`;
          }

          const actualValue = context.value ? getNestedValue(context.value, fieldPath) : undefined;
          return `[Polling] ${message} | attempt ${context.attempt} | ${fieldPath}=${describeValue(actualValue)} | expected=${describeValue(expectedValue)} | elapsed ${context.elapsedMs}ms / ${context.timeoutMs}ms`;
        }),
    }
  );
}

/**
 * Convenient helper bundle for import or fixture based usage.
 */
export const polling = {
  recurse,
  waitForResponseStatus,
  waitForResponseFieldValue,
  getNestedValue,
};

export type PollingHelpers = typeof polling;
