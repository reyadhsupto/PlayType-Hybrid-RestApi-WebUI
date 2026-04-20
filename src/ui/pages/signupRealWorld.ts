// src/ui/pages/setupRealWorld.ts

import {Locator, Page} from '@playwright/test';
import { BasePage, step } from "./basePage.js";

export class SignupRealWorld extends BasePage{

    readonly signUpButton : Locator;
    readonly signupText : Locator;
    readonly username : Locator;
    readonly email : Locator;
    readonly password : Locator;
    readonly submitBtn : Locator;
    readonly loggedInIcon : Locator;

    constructor(page: Page){
        super(page);
        this.page = page;
        this.signUpButton = this.page.getByRole('link', { name: 'Sign up' });
        this.signupText = this.page.getByRole('heading', { name: 'Sign up', level: 1 });
        this.username = this.page.getByRole('textbox', { name: 'Username' });
        this.email = this.page.getByRole('textbox', { name: 'Email' });
        this.password = this.page.getByRole('textbox', { name: 'Password' });
        this.submitBtn = this.page.getByRole('button', { name: 'Sign up' });
        this.loggedInIcon = this.page.getByRole('link', { name: 'tester' });
    }

    @step('clicking signup button')
    async clickSignupButton(){
        await this.click(this.signUpButton)
    }

    @step('Verifying signup page is displayed')
    async verifySignupPage(): Promise<Locator>{
        return this.signupText;
    }

    @step('Checking if submit button is disabled before fill form')
    async isSubmitBtnDisabled(): Promise<boolean>{
        await this.waitForPageLoadIdle();
        const isdisabled = await this.submitBtn.isDisabled({timeout: 5000});
        return isdisabled;
    }

    @step('Filling signup form with username: {{username}}, email: {{email}}')
    async fillForm(username: string, email: string, password:string){
        await this.fill(this.username, username);
        await this.fill(this.email, email);
        await this.fill(this.password, password);
    }

    @step('Clicking submit button after filling form')
    async clickSubmitBtn(){
        await this.click(this.submitBtn);
    }

    /**
     * Verifies that the user is logged in by checking:
     * 1. Profile link is visible
     * 2. href contains '/profile/' (matches /profile/*)
     * 
     * @returns boolean - true if logged in, false otherwise
     */
    @step('Checking if user is automatically logged in after signup')
    async isLoggedIn(): Promise<boolean>{
        await this.waitForPageLoadIdle();

        // Check if the logged in icon/link is visible
        const isVisible = await this.loggedInIcon.isVisible();
        
        if (!isVisible) {
            return false;
        }

        // Get the href attribute and check if it matches /profile/*
        const href = await this.loggedInIcon.getAttribute('href');
        
        if (!href || !href.includes('/profile/')) {
            return false;
        }

        return true;
    }
}