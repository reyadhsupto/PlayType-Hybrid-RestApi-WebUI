// tests/api/testRealWorldApi/user.spec.ts

import { test, expect, BaseTest } from "../../BaseApiTest.js";
import { registerUserSchemaZod, loginUserSchema } from "../schemas.js"


// test.beforeAll(async () => {
//   await BaseTest.setup(BaseTest.env_config.api_base_url);
// });

// test.afterAll(async () => {
//   await BaseTest.teardown();
// });
let email : string = "";
let password: string = "password";
test.describe.configure({ mode: 'serial' });  // Forces sequential execution

test.describe( "Register, login user, update user", { tag: ['@SC_001'] }, ()=>{
    test("Verify that Api returns 201 created upon successfull user registration", {tag: ["@TC_001"]}, async ({ rwService }) => {
    BaseTest.logTestTitle("Test Details:", test.info().title);

    const response = await rwService.registerUser( 
      BaseTest.generator.registerUser(
        )
    );
    const responseBody = await response.json();
    email = responseBody['user']['email'];

    await rwService.assertStatus(response, 201);
    await rwService.validateZodSchema(response , registerUserSchemaZod);
  });

  test("Verify that api returns 200 OK with token in response",{tag: ["@TC_002"]}, async ({rwService}) => {
    BaseTest.logTestTitle("Test Details:", test.info().title);

    const response = await rwService.loginUser( BaseTest.generator.loginUser(email, password) );

    await rwService.assertStatus(response, 200);
    await rwService.validateField(response, "user.email", email);
    await rwService.validateZodSchema(response , loginUserSchema);
  });
});

test.describe( "Check direct api call", { tag: ['@SC_002'] }, ()=>{
    test("Verify that Api returns all user list with 200 OK", {tag: ["@TC_003"]}, async ({apiClient, rwService}) => {
    BaseTest.logTestTitle("Test Details:", test.info().title);
      const response = await apiClient.callDirectApi({
      url: 'https://api.restful-api.dev/objects',
      method: 'GET'
    });
    await rwService.assertStatus(response, 200);

  });
});
