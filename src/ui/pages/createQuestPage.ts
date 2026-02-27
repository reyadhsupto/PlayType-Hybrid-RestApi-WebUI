// src/ui/pages/createQuestPage.ts

import { Page } from '@playwright/test';
import { BasePage } from './basePage.js';

export class CreateQuestPage extends BasePage {
  constructor(page: Page) {
    super(page);
    this.page = page;
  }

  async clickCreateButton() {
    await this.clickElement('.fa.fa-plus');
    // await this.waitForSeconds(15);
    await this.pause();
  }

  async fillQuestForm({ name, description }: { name: string; description: string }) {
    await this.page.fill('input[name="questName"]', name);
    await this.page.fill('textarea[name="questDescription"]', description);
  }

  async submitQuest() {
    await this.page.click('button[type="submit"]');
  }

  async getSuccessMessage() {
    return this.page.textContent('.success-message');
  }
}
