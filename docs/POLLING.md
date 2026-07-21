# Polling Guide

Reusable polling utilities for waiting on asynchronous API and workflow states in the PlayType framework.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Import Usage](#import-usage)
- [Fixture Usage](#fixture-usage)
- [Available Helpers](#available-helpers)
- [Logging](#logging)
- [Examples](#examples)
- [Recommended Settings](#recommended-settings)

---

## Overview

Use the polling helpers when a state does not become available immediately.

Typical examples:

- wait for a ride to be dispatched
- wait for a driver to accept an order
- wait for a completed ride to settle payment
- wait for a wallet balance or due amount to update

The helper repeats the command after every interval until the expected value is found or the timeout is reached.

---

## How It Works

The polling flow is simple:

1. Execute the command
2. Inspect the returned value
3. Compare it against the expected condition
4. Log the attempt
5. Wait for the configured interval
6. Repeat until success or timeout

The helper supports both success paths:

- exact status matches
- field value matches using dot or bracket notation

It also keeps the last seen value and last error so timeout failures are easier to debug.

---

## Import Usage

Use the helper directly when you want the lightest possible integration.

```typescript
import {
  recurse,
  waitForResponseStatus,
  waitForResponseFieldValue
} from "../src/sharedUtils/recurse.js";
```

### Generic Polling

```typescript
const ride = await recurse(
  () => apiClient.callApi({
    path_param: `/rides/${rideId}`,
    method: "GET"
  }),
  (response) => response.status() === 200,
  {
    message: "Waiting for ride details to become available",
    timeoutMs: 30000,
    intervalMs: 1500
  }
);
```

### Status Polling

```typescript
const response = await waitForResponseStatus(
  () => apiClient.callApi({
    path_param: `/rides/${rideId}`,
    method: "GET"
  }),
  200,
  {
    message: "Waiting for ride lookup to succeed",
    timeoutMs: 30000,
    intervalMs: 2000
  }
);
```

### Field Polling

```typescript
const rideBody = await waitForResponseFieldValue(
  () => apiClient.callApi({
    path_param: `/rides/${rideId}`,
    method: "GET"
  }).then((response) => response.json()),
  "ride.state",
  "DISPATCHED",
  {
    message: "Waiting for ride to be dispatched",
    timeoutMs: 60000,
    intervalMs: 2000
  }
);
```

---

## Fixture Usage

The same helpers are available through `BaseApiTest.ts` as a fixture and as a static utility.

### Usage Matrix

| Style | Import helper | Use fixture | Use static `BaseTest` | Best when |
|------|---------------|-------------|------------------------|-----------|
| Plain import | Yes | No | No | You want the smallest possible setup |
| Fixture only | No | Yes | No | You already use Playwright fixture injection |
| Static utility | No | No | Yes | You want direct access from a test or helper |
| Mixed | Yes | Yes | No | You want both explicit imports and injected helpers |
| Mixed static | No | Yes | Yes | You want fixture injection plus `BaseTest` logging and helpers |

```typescript
import { test, BaseTest } from "../../BaseApiTest.js";

test("wait with fixture", async ({ polling, apiClient }) => {
  const response = await polling.waitForResponseStatus(
    () => apiClient.callApi({
      path_param: "/health",
      method: "GET"
    }),
    200,
    {
      message: "Waiting for health endpoint",
      timeoutMs: 15000,
      intervalMs: 1000
    }
  );

  BaseTest.logger.info(`Final status: ${response.status()}`);
});
```

You can also use the static helper when a fixture is not convenient:

```typescript
await BaseTest.polling.waitForResponseFieldValue(
  () => apiClient.callApi({
    path_param: `/rides/${rideId}`,
    method: "GET"
  }).then((response) => response.json()),
  "payment.balance.due",
  0,
  {
    message: "Waiting for due amount to be cleared",
    timeoutMs: 60000,
    intervalMs: 2000
  }
);
```

And you can combine `BaseTest.polling` with any other test fixture:

```typescript
test("static polling with apiClient", async ({ apiClient }) => {
  const body = await BaseTest.polling.waitForResponseFieldValue(
    async () => {
      const response = await apiClient.callApi({
        path_param: "/profile",
        method: "GET"
      });
      return response.json();
    },
    "user.status",
    "ACTIVE",
    {
      message: "Waiting for user profile to become ACTIVE",
      timeoutMs: 30000,
      intervalMs: 1000
    }
  );

  BaseTest.logger.info(`Profile status: ${body.user.status}`);
});
```

If you want to keep the helper fully local to a spec, use the imported utility directly with injected fixtures:

```typescript
import { recurse } from "../../src/sharedUtils/recurse.js";

test("imported recurse with foodApi", async ({ foodApi }) => {
  const body = await recurse(
    async () => {
      const response = await foodApi.getRestaurantDetails();
      return response.json();
    },
    (data) => data.accepting_orders === true,
    {
      message: "Waiting for restaurant to accept orders",
      timeoutMs: 30000,
      intervalMs: 2000
    }
  );

  expect(body.accepting_orders).toBe(true);
});
```

---

## Available Helpers

### `recurse`

The low level helper.

```typescript
recurse<T>(
  command: () => Promise<T>,
  predicate: (value: T) => boolean | Promise<boolean>,
  options?: PollingOptions<T>
): Promise<T>
```

Use it when the success condition is more complex than a simple field comparison.

### `waitForResponseStatus`

Waits until `response.status()` matches the expected HTTP status.

### `waitForResponseFieldValue`

Waits until a nested field matches an expected value.

It supports paths such as:

- `ride.state`
- `ride.payment.status`
- `wallet.balance.current`
- `items[0].status`

### `getNestedValue`

Resolves a nested value from an object using dot and bracket notation.

---

## Logging

Every poll attempt can be logged.

Default log output includes:

- attempt number
- elapsed time
- timeout value
- last status or field value
- last error when the command fails

Example message:

```text
[Polling] Waiting for ride to be dispatched | attempt 3 | elapsed 4000ms / 60000ms | value={"state":"SEARCHING"}
```

You can also pass a custom log callback if you want a more specific message.

---

## Examples

### 1. HTTP Status Polling

Wait until an endpoint starts returning the expected HTTP status.

```typescript
const response = await waitForResponseStatus(
  () => apiClient.callApi({
    path_param: `/restaurants/${restaurantId}`,
    method: "GET"
  }),
  200,
  {
    message: "Waiting for restaurant details to return 200",
    timeoutMs: 30000,
    intervalMs: 1000
  }
);
```

Use this when the backend is eventually consistent and a resource may return `404`, `202`, or `409` before it becomes ready.

### 1A. Status Polling with Imported Helper and `apiClient`

```typescript
import { waitForResponseStatus } from "../../src/sharedUtils/recurse.js";

test("poll status with apiClient", async ({ apiClient }) => {
  const response = await waitForResponseStatus(
    () => apiClient.callApi({
      path_param: `/rides/${rideId}`,
      method: "GET"
    }),
    200,
    {
      message: "Waiting for ride endpoint",
      timeoutMs: 60000,
      intervalMs: 2000
    }
  );

  expect(response.status()).toBe(200);
});
```

### 1B. Status Polling with Fixture and `foodApi`

```typescript
test("poll status with fixture and foodApi", async ({ polling, foodApi }) => {
  const response = await polling.waitForResponseStatus(
    () => foodApi.getRestaurantDetails(),
    201,
    {
      message: "Waiting for restaurant details endpoint",
      timeoutMs: 30000,
      intervalMs: 1000
    }
  );

  expect(response.status()).toBe(201);
});
```

### 2. Top Level Field Polling

Wait until a simple response field reaches the expected value.

```typescript
const body = await waitForResponseFieldValue(
  async () => {
    const response = await foodApi.getRestaurantDetails();
    return response.json();
  },
  "accepting_orders",
  true,
  {
    message: "Waiting for accepting_orders to become true",
    timeoutMs: 30000,
    intervalMs: 2000
  }
);
```

This is the cleanest option when the field is already at the top level of the response body.

### 2A. Top Level Field Polling with Imported Helper and `foodApi`

```typescript
import { waitForResponseFieldValue } from "../../src/sharedUtils/recurse.js";

test("poll top level field with foodApi", async ({ foodApi }) => {
  const body = await waitForResponseFieldValue(
    async () => {
      const response = await foodApi.getRestaurantDetails();
      return response.json();
    },
    "accepting_orders",
    true,
    {
      message: "Waiting for accepting_orders",
      timeoutMs: 30000,
      intervalMs: 2000
    }
  );

  expect(body.accepting_orders).toBe(true);
});
```

### 2B. Top Level Field Polling with Fixture and `apiClient`

```typescript
test("poll top level field with fixture and apiClient", async ({ polling, apiClient }) => {
  const body = await polling.waitForResponseFieldValue(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    "ride_count",
    1,
    {
      message: "Waiting for ride count to reach 1",
      timeoutMs: 30000,
      intervalMs: 1000
    }
  );

  expect(body.ride_count).toBe(1);
});
```

### 3. Nested Field Polling

Wait until a nested value changes.

```typescript
await waitForResponseFieldValue(
  async () => {
    const response = await apiClient.callApi({
      path_param: `/rides/${rideId}`,
      method: "GET"
    });
    return response.json();
  },
  "user.status",
  "ACTIVE",
  {
    message: "Waiting for user.status to become ACTIVE",
    timeoutMs: 60000,
    intervalMs: 2000
  }
);
```

Nested paths also support array notation.

### 3A. Nested Field Polling with Static `BaseTest`

```typescript
test("poll nested field with BaseTest", async ({ apiClient }) => {
  const body = await BaseTest.polling.waitForResponseFieldValue(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    "ride.payment.status",
    "PAID",
    {
      message: "Waiting for ride.payment.status to become PAID",
      timeoutMs: 60000,
      intervalMs: 2000
    }
  );

  expect(body.ride.payment.status).toBe("PAID");
});
```

```typescript
await waitForResponseFieldValue(
  async () => {
    const response = await apiClient.callApi({
      path_param: `/rides/${rideId}`,
      method: "GET"
    });
    return response.json();
  },
  "events[0].state",
  "DISPATCHED",
  {
    message: "Waiting for first event state to become DISPATCHED",
    timeoutMs: 60000,
    intervalMs: 2000
  }
);
```

### 4. Generic Predicate Polling

Use `recurse` directly when one field is not enough.

### 4A. Generic Predicate Polling with Imported Helper and `apiClient`

```typescript
import { recurse } from "../../src/sharedUtils/recurse.js";

test("poll custom condition with apiClient", async ({ apiClient }) => {
  const body = await recurse(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    (data) => data.ride.status === "COMPLETED" && data.payment.received === true,
    {
      message: "Waiting for ride completion and payment receipt",
      timeoutMs: 60000,
      intervalMs: 2000
    }
  );

  expect(body.ride.status).toBe("COMPLETED");
});
```

### 4B. Generic Predicate Polling with Fixture and `foodApi`

```typescript
test("poll custom condition with fixture and foodApi", async ({ polling, foodApi }) => {
  const body = await polling.recurse(
    async () => {
      const response = await foodApi.getRestaurantDetails();
      return response.json();
    },
    (data) => data.accepting_orders === true && data.open === true,
    {
      message: "Waiting for restaurant to open and accept orders",
      timeoutMs: 30000,
      intervalMs: 2000
    }
  );

  expect(body.accepting_orders).toBe(true);
});
```

```typescript
await recurse(
  async () => {
    const response = await apiClient.callApi({
      path_param: `/rides/${rideId}`,
      method: "GET"
    });
    return response.json();
  },
  (body) => body.ride.status === "COMPLETED" && body.payment.received === true,
  {
    message: "Waiting for ride completion and payment receipt",
    timeoutMs: 60000,
    intervalMs: 2000
  }
);
```

### 5. Ride Dispatch Flow

Typical driver matching flow.

### 5A. Ride Dispatch with Imported Helper and Driver API

```typescript
import { recurse } from "../../src/sharedUtils/recurse.js";

test("wait for ride dispatch", async ({ driverApi }) => {
  const body = await recurse(
    async () => {
      const response = await driverApi.getAssignedRide(driverId);
      return response.json();
    },
    (data) => data.assignment?.status === "DISPATCHED",
    {
      message: "Waiting for ride dispatch to driver",
      timeoutMs: 90000,
      intervalMs: 3000
    }
  );

  expect(body.assignment.status).toBe("DISPATCHED");
});
```

```typescript
await recurse(
  async () => {
    const response = await driverApi.getAssignedRide(driverId);
    return response.json();
  },
  (body) => body.assignment?.status === "DISPATCHED",
  {
    message: "Waiting for ride dispatch to driver",
    timeoutMs: 90000,
    intervalMs: 3000
  }
);
```

### 6. Driver Acceptance Flow

Wait until the driver accepts the dispatched ride.

### 6A. Driver Acceptance with Fixture and `apiClient`

```typescript
test("wait for driver acceptance", async ({ polling, apiClient }) => {
  const body = await polling.waitForResponseFieldValue(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    "ride.acceptance.status",
    "ACCEPTED",
    {
      message: "Waiting for driver acceptance",
      timeoutMs: 60000,
      intervalMs: 2000
    }
  );

  expect(body.ride.acceptance.status).toBe("ACCEPTED");
});
```

```typescript
await waitForResponseFieldValue(
  async () => {
    const response = await driverApi.getRideDetails(rideId);
    return response.json();
  },
  "ride.acceptance.status",
  "ACCEPTED",
  {
    message: "Waiting for driver acceptance",
    timeoutMs: 60000,
    intervalMs: 2000
  }
);
```

### 7. Ride Completion Flow

Wait until the ride finishes and the trip state becomes completed.

### 7A. Ride Completion with Static `BaseTest`

```typescript
test("wait for ride completion", async ({ apiClient }) => {
  const body = await BaseTest.polling.waitForResponseFieldValue(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    "ride.status",
    "COMPLETED",
    {
      message: "Waiting for ride completion",
      timeoutMs: 60000,
      intervalMs: 2000
    }
  );

  expect(body.ride.status).toBe("COMPLETED");
});
```

```typescript
await waitForResponseFieldValue(
  async () => {
    const response = await driverApi.getRideDetails(rideId);
    return response.json();
  },
  "ride.status",
  "COMPLETED",
  {
    message: "Waiting for ride completion",
    timeoutMs: 60000,
    intervalMs: 2000
  }
);
```

### 8. Payment Settlement Flow

Use polling to wait for wallet or due balance changes after payment.

### 8A. Payment Settlement with Imported Helper and `apiClient`

```typescript
import { recurse } from "../../src/sharedUtils/recurse.js";

test("wait for payment settlement", async ({ apiClient }) => {
  const body = await recurse(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/drivers/${driverId}/wallet`,
        method: "GET"
      });
      return response.json();
    },
    (data) => data.wallet.balance.due === 0 && data.wallet.balance.current >= 0,
    {
      message: "Waiting for due balance to settle",
      timeoutMs: 60000,
      intervalMs: 3000
    }
  );

  expect(body.wallet.balance.due).toBe(0);
});
```

```typescript
await recurse(
  async () => {
    const response = await driverApi.getWalletSummary(driverId);
    return response.json();
  },
  (body) => body.wallet.balance.due === 0 && body.wallet.balance.current >= 0,
  {
    message: "Waiting for due balance to settle",
    timeoutMs: 60000,
    intervalMs: 3000
  }
);
```

### 9. Food Flow Example

Your current food API flow can also use the helper to wait for restaurant state.

### 9A. Food Flow with Fixture and `foodApi`

```typescript
const pollResult = await polling.recurse(
  async () => {
    const response = await foodApi.getRestaurantDetails();
    return response.json();
  },
  (body) => body.accepting_orders === true,
  {
    message: "Waiting for accepting_orders to become true",
    timeoutMs: 30000,
    intervalMs: 2000
  }
);
```

### 9B. Food Flow with Static `BaseTest` and `foodApi`

```typescript
test("food flow with BaseTest polling", async ({ foodApi }) => {
  const body = await BaseTest.polling.recurse(
    async () => {
      const response = await foodApi.getRestaurantDetails();
      return response.json();
    },
    (data) => data.accepting_orders === true,
    {
      message: "Waiting for accepting_orders to become true",
      timeoutMs: 30000,
      intervalMs: 2000
    }
  );

  expect(body.accepting_orders).toBe(true);
});
```

### 10. Polling With Logging Disabled

Use this when you want the helper to retry quietly and only fail at the end.

### 10A. Silent Polling with Imported Helper and `apiClient`

```typescript
await recurse(
  async () => {
    const response = await apiClient.callApi({
      path_param: `/rides/${rideId}`,
      method: "GET"
    });
    return response.json();
  },
  (body) => body.driver?.online === true,
  {
    message: "Waiting for driver online state",
    timeoutMs: 45000,
    intervalMs: 1500,
    log: false
  }
);
```

### 11. Custom Polling Log Message

If you want more control over the log line, pass a custom callback.

### 11A. Custom Log with Fixture and `apiClient`

```typescript
await recurse(
  async () => {
    const response = await apiClient.callApi({
      path_param: `/rides/${rideId}`,
      method: "GET"
    });
    return response.json();
  },
  (body) => body.payment?.received === true,
  {
    message: "Waiting for payment receipt",
    timeoutMs: 60000,
    intervalMs: 2000,
    log: (context) => {
      return `Ride ${rideId} poll ${context.attempt}: payment received = ${String(context.value?.payment?.received)}`;
    }
  }
);
```

### 12. Combined Fixture and Import Style

You can also mix fixture access with direct imports.

```typescript
import { recurse } from "../../src/sharedUtils/recurse.js";

test("combined style", async ({ polling, apiClient }) => {
  const ride = await polling.waitForResponseStatus(
    () => apiClient.callApi({
      path_param: `/rides/${rideId}`,
      method: "GET"
    }),
    200,
    {
      message: "Waiting for ride endpoint",
      timeoutMs: 30000,
      intervalMs: 1000
    }
  );

  await recurse(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    (body) => body.ride.status === "SEARCHING",
    {
      message: "Waiting for ride search state",
      timeoutMs: 30000,
      intervalMs: 1000
    }
  );
});
```

### 13. Fixture Only Style

If you want to avoid imports in the spec body, keep everything on the fixture and `BaseTest`.

```typescript
test("fixture only", async ({ polling, apiClient }) => {
  const body = await polling.recurse(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    (data) => data.ride.status === "SEARCHING",
    {
      message: "Waiting for ride search state",
      timeoutMs: 30000,
      intervalMs: 1000
    }
  );

  expect(body.ride.status).toBe("SEARCHING");
});
```

### 14. Static Plus Fixture Mix

This style is useful when you want the fixture for execution and `BaseTest` for logging.

```typescript
test("mixed static style", async ({ polling, apiClient }) => {
  BaseTest.logger.info("Starting ride wait");

  const body = await polling.waitForResponseFieldValue(
    async () => {
      const response = await apiClient.callApi({
        path_param: `/rides/${rideId}`,
        method: "GET"
      });
      return response.json();
    },
    "ride.status",
    "DISPATCHED",
    {
      message: "Waiting for dispatch",
      timeoutMs: 60000,
      intervalMs: 2000
    }
  );

  BaseTest.logger.info(`Ride status: ${body.ride.status}`);
});
```

---

## Recommended Settings

- Use shorter intervals for fast moving states, such as `1000` to `2000` ms
- Use longer timeouts for payment settlement or async back office processes
- Keep the log message specific to the business event being waited on
- Prefer the convenience helpers for simple exact matches
- Use `recurse` directly when the predicate is more complex
