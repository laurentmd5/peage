import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, role: 'admin' | 'superviseur' | 'caissier1' | 'caissier2' = 'admin') {
  await page.goto('/');
  const quickBtn = page.locator(`#btn-quick-${role}`);
  if (await quickBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await quickBtn.click();
  }
  await expect(page.locator('text=AREZKI BISSAU').first()).toBeVisible({ timeout: 10000 });
}
