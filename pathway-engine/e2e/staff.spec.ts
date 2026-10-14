import { expect, test } from '@playwright/test';
import { shot } from './fixtures';

test.skip(({ viewport }) => (viewport?.width ?? 0) < 900, 'Staff consoles are checked on desktop');

test('mentor sees every score behind a plan; admin sees the catalogue', async ({ page }) => {
  await page.goto('/staff');
  await page.getByLabel('Access code').fill('mentor-e2e');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible();
  await shot(page, 'desktop-20-mentor-list');
  await page.getByText('Asha Kumari').first().click();
  await expect(page.getByRole('heading', { name: 'Persona and axes' })).toBeVisible();
  await expect(page.getByText('I can study in the evenings.')).toBeVisible();
  await page.getByRole('button', { name: 'Replay this run' }).click();
  await expect(page.getByText('Replay matches the stored run exactly.')).toBeVisible();
  await shot(page, 'desktop-21-mentor-detail');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('radio', { name: 'Content admin' }).click();
  await page.getByLabel('Access code').fill('admin-e2e');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Pathway Engine admin' })).toBeVisible();
  await expect(page.getByText('SwiftChat Bot Builder')).toBeVisible();
  await shot(page, 'desktop-22-admin-courses');
  await page.getByRole('tab', { name: 'Config versions' }).click();
  await expect(page.getByRole('heading', { name: 'Config versions' })).toBeVisible();
  await page.getByRole('tab', { name: 'Catalogue' }).click();
  await expect(page.getByText('SK-COMM-001')).toBeVisible();
});
