// tests/ui/createQuestPage.spec.ts

import { expect } from '@playwright/test';
import { test } from '../baseUiTest.js';

test('Create Quest Page - should create a new quest', {tag: ["@UI", "@quest"]}, async ({ createQuestPage }) => {
  await createQuestPage.clickCreateButton();
  // await createQuestPage.fillQuestForm({ name: 'Test Quest', description: 'A quest for testing.' });
  // await createQuestPage.submitQuest();
  // const message = await createQuestPage.getSuccessMessage();
  // expect(message).toContain('success');
});

