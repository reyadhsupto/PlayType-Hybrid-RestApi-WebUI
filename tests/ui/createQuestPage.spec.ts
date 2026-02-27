// tests/ui/createQuestPage.spec.ts

import { expect } from '@playwright/test';
import { test } from '../baseUiTest.js';
// import { CreateQuestPage } from '../../src/ui/pages/createQuestPage.js';

test('Create Quest Page - should create a new quest', {tag: ["@UI"]},async ({ poManager }) => {
  const createQuestPage = poManager.getCreateQuestPage();

  await createQuestPage.clickCreateButton();
//   createQuestPage.page = basePage.page;
//   await createQuestPage.fillQuestForm({ name: 'Test Quest', description: 'A quest for testing.' });
//   await createQuestPage.submitQuest();
//   const message = await createQuestPage.getSuccessMessage();
//   expect(message).toContain('success');
});

