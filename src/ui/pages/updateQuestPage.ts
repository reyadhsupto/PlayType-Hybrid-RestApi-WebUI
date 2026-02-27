import { Page } from '@playwright/test';
import { BasePage } from './basePage.js';

export class UpdateQuestPage extends BasePage {
  constructor(page: Page) {
    super(page);
    this.page = page;
  }

  async updateQuestName(newName: string) {
    await this.page.fill('input[name="questName"]', newName);
  }

  async updateQuestDescription(newDescription: string) {
    await this.page.fill('textarea[name="questDescription"]', newDescription);
  }

  async saveChanges() {
    await this.page.click('button[type="submit"]');
  }

  async getUpdateMessage() {
    return this.page.textContent('.update-message');
  }
}
