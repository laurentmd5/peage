import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.ts';

test.describe('Scénario E2E 3 : Procédure d\'Ouverture Manuelle & Audit', () => {
  test('devrait ouvrir manuellement la barrière avec motif et vérifier la consignation dans l\'audit', async ({ page }) => {
    await loginAs(page, 'superviseur');

    // Aller sur poste de caisse
    const tabCaisse = page.locator('button:has-text("Poste de Caisse")');
    await tabCaisse.click();

    // Cliquer sur ouverture manuelle
    const btnManual = page.locator('text=Ouverture Manuelle (Tracée)');
    await btnManual.click();

    await expect(page.locator('text=Ouverture Manuelle de Barrière (Procédure d\'Urgence)')).toBeVisible();

    // Saisir le motif d'urgence
    const reasonInput = page.locator('#input-manual-barrier-reason');
    await reasonInput.fill('Test Urgence E2E Convoi Protocolaire');

    await page.locator('#btn-confirm-manual-barrier').click();

    // Vérifier l'état de la barrière avec matching exact
    await expect(page.getByText('OUVERTE', { exact: true })).toBeVisible();

    // Aller vérifier le journal d'audit
    const tabAudit = page.locator('button:has-text("Journal d\'Audit")');
    await tabAudit.click();

    await expect(page.locator('text=Journal d\'Audit & Traçabilité Réglementaire')).toBeVisible();
    await expect(page.locator('text=MANUAL_BARRIER_OPEN').first()).toBeVisible({ timeout: 5000 });
  });
});
