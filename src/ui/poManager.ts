// src/ui/poManager.ts

import { Page } from '@playwright/test';
import { CreateQuestPage } from './pages/createQuestPage.js';
import { UpdateQuestPage } from './pages/updateQuestPage.js';

export class POManager {
  private createQuestPage: CreateQuestPage;
  private updateQuestPage: UpdateQuestPage;

  constructor(page: Page) {
    this.createQuestPage = new CreateQuestPage(page);
    this.updateQuestPage = new UpdateQuestPage(page);
  }

  getCreateQuestPage() {
    return this.createQuestPage;
  }

  getUpdateQuestPage() {
    return this.updateQuestPage;
  }
}