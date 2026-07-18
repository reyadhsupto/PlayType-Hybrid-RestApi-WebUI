// tests/api/testRealWorldApi/user.spec.ts

import { test, expect, BaseTest } from "../../BaseApiTest.js";
// import { registerUserSchemaZod, loginUserSchema } from "../schemas.js"


// test.beforeAll(async () => {
//   await BaseTest.setup(BaseTest.env_config.api_base_url);
// });

// test.afterAll(async () => {
//   await BaseTest.teardown();
// });

// test.describe.configure({ mode: 'serial' });  // Forces sequential execution

test.describe.serial( "Call Restauant info and verify if restaurant is accepting orders", { tag: ['@SC_PF_001','@FoodApi'] }, ()=>{
    test("Verify that Api returns 201 with accepting orders in response", {tag: ["@TC_PF_001"]}, async ({ foodApi, dbClient }) => {
    BaseTest.logTestTitle("Test Details:", test.info().title);
    
    const response = await foodApi.getRestaurantDetails();
    const responseBody = await response.json();
    const accepting_orders = responseBody['accepting_orders'];

    await foodApi.assertStatus(response, 201, {mode: "soft"});
    await foodApi.validateField(response, "accepting_orders", true);
    const results = await dbClient.query('resto',"SELECT accepting_order FROM restaurant_resto WHERE parse_id = 12000156;")
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].accepting_order).toBe(true);

  });
});
