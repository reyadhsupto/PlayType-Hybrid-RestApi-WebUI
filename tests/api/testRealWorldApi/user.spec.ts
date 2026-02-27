import { test } from "@playwright/test";
import { BaseTest } from "../../BaseApiTest.js";
import { registerUserSchemaZod, loginUserSchema } from "../schemas.js"


test.beforeAll(async () => {
  await BaseTest.setup(BaseTest.env_config.api_base_url);
});

test.afterAll(async () => {
  await BaseTest.teardown();
});
let email : string = "";
let password: string = "password";
test.describe.configure({ mode: 'serial' });  // Forces sequential execution

test.describe( "Register, login user, update user", { tag: ['@SC_001'] }, ()=>{
    test("Verify that Api returns 201 created upon successfull user registration", {tag: ["@TC_001"]}, async () => {
    BaseTest.logTestTitle("Test Details:", test.info().title);

    const response = await BaseTest.rw.registerUser( 
      BaseTest.generator.registerUser(
        )
    );
    const responseBody = await response.json();
    email = responseBody['user']['email'];

    await BaseTest.rw.assertStatus(response, 201);
    await BaseTest.rw.validateZodSchema(response , registerUserSchemaZod);
  });

  test("Verify that api returns 200 OK with token in response",{tag: ["@TC_002"]}, async () => {
    BaseTest.logTestTitle("Test Details:", test.info().title);

    const response = await BaseTest.rw.loginUser( BaseTest.generator.loginUser(email, password) );

    await BaseTest.rw.assertStatus(response, 200);
    await BaseTest.rw.validateField(response, "user.email", email);
    await BaseTest.rw.validateZodSchema(response , loginUserSchema);
  });
});
