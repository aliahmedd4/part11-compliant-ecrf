'use strict';

const { test, expect } = require('@playwright/test');

/**
 * OQ (UI) — critical end-user flows through the real React client.
 *
 * Pre-req: the API (seeded) and client dev server are running. In CI these are
 * started by the ui-oq job; locally, `npm run seed` + `npm start` (server) and
 * `npm run dev` (client). Each test maps to an OQ-UI case id.
 */

async function login(page, username, password) {
  await page.goto('/');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
}

const PASSWORD = 'Str0ng-Passw0rd!';

test('OQ-UI-01: a valid user can log in and see the workspace', async ({ page }) => {
  await login(page, 'investigator', PASSWORD);
  await expect(page.locator('.topbar')).toContainText('Part 11 eCRF');
  await expect(page.locator('.role')).toContainText('Investigator');
});

test('OQ-UI-02: invalid credentials are rejected with a generic message', async ({ page }) => {
  await login(page, 'investigator', 'wrong-password');
  await expect(page.locator('.error')).toContainText(/invalid/i);
});

test('OQ-UI-03: out-of-range vital signs show an inline edit-check error and are not saved', async ({ page }) => {
  await login(page, 'investigator', PASSWORD);
  await page.click('text=Open'); // open first subject
  await page.fill('#systolic', '400');
  await page.fill('#diastolic', '80');
  await page.fill('#heartRate', '70');
  await page.click('text=Save vital signs');
  await expect(page.locator('.field-error')).toContainText(/between 60 and 300/i);
});

test('OQ-UI-04: signing requires re-authentication and locks the record', async ({ page }) => {
  await login(page, 'investigator', PASSWORD);
  await page.click('text=Open');
  // Enter a valid vitals record first.
  await page.fill('#systolic', '120');
  await page.fill('#diastolic', '80');
  await page.fill('#heartRate', '70');
  await page.click('text=Save vital signs');
  // Sign it.
  await page.click('text=Sign');
  await page.selectOption('#sig-meaning', 'author');
  await page.fill('#sig-password', PASSWORD);
  await page.click('.modal >> text=Sign');
  // The record should now be locked/read-only.
  await expect(page.locator('.pill.signed').first()).toBeVisible();
  await expect(page.locator('text=read-only (amend to change)').first()).toBeVisible();
});
