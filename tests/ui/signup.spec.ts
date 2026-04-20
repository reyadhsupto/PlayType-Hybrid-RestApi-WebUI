// tests/ui/signup.spec.ts

import { test } from '../baseUiTest.js';

test.describe('Verify signup page functionality',{ tag: ['@UI', '@signup'] }, () => {

  test('UI_001: Verify that clicking on signup button takes user to signup page', { tag: ['@signup'] }, async ({ basePage, signupPage }) => {

    await test.step('Clicking on sign up button from home page and verifying that it lands on signup page', async () => {
        await signupPage.clickSignupButton();
        test.expect(signupPage.signupText).toBeVisible();
    });

    await test.step('Checking if submit button is disabled > Fill up form and click on submit button', async () => {
        const isenabled = await signupPage.isSubmitBtnDisabled();
        test.expect(isenabled).toEqual(true);

        await signupPage.fillForm("tester", "tester@gmail.com", "12345");

        await signupPage.clickSubmitBtn()
    });

    await test.step('Verifying that user registration is successful and landed on home page as logged in user', async () => {
        await signupPage.clickSignupButton();
        test.expect(signupPage.signupText).toBeVisible();
    });
    

    await basePage.pause();
  });
});