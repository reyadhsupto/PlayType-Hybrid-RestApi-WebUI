// tests/api/testRealWorldApi/user.spec.ts

import { test, expect, BaseTest } from "../../BaseApiTest.js";
// import { registerUserSchemaZod, loginUserSchema } from "../schemas.js"

// test.describe.configure({ mode: 'serial' });  // Forces sequential execution

test.describe.serial( "Call Restauant info and verify if restaurant is accepting orders", { tag: ['@SC_PF_001','@FoodApi'] }, ()=>{
    test("Verify that Api returns 201 with accepting orders in response", {tag: ["@TC_PF_001"]}, async ({ foodApi, dbClient, polling }) => {
    BaseTest.logTestTitle("Test Details:", test.info().title);

    // Prewarm only the databases this flow actually uses.
    // await dbClient.prewarm(["resto", "pathao_api"]);
    
    const response = await foodApi.getRestaurantDetails();
    const responseBody = await response.json();
    const accepting_orders = responseBody['accepting_orders'];

    await foodApi.assertStatus(response, 201, {mode: "soft"});
    await foodApi.validateField(response, "accepting_orders", true);
    const results = await dbClient.query('resto',"SELECT accepting_order FROM restaurant_resto WHERE parse_id = 12000156;")
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].accepting_order).toBe(true);

    const pollResult = await polling.recurse(
      async ()=> {
        const response = await foodApi.getRestaurantDetails();
        return response.json()
      },
      (body) => body.accepting_orders === false,
      {
        message: "Waiting for body.accepting_orders to be true",
        timeoutMs: 30000,
        intervalMs: 2000,
      }
    );
    
  });
});
