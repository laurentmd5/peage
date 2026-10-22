import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.ts';

test.describe('Scénario E2E 4 : Tableau de Bord & Rapports Officiels', () => {
  test('devrait consulter les indicateurs temps réel et afficher le rapport d\'exploitation officiel', async ({ page }) => {
    await loginAs(page, 'admin');

    // 1. Consulter le Dashboard
    const tabDashboard = page.locator('button:has-text("Tableau de Bord")');
    await tabDashboard.click();

    await expect(page.locator('text=Tableau de Bord Supervision Temps Réel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Passages Aujourd\'hui')).toBeVisible();
    await expect(page.locator('text=Recettes du Jour')).toBeVisible();
    await expect(page.locator('text=Supervision des Équipements')).toBeVisible();

    // 2. Consulter les Rapports
    const tabRapports = page.locator('button:has-text("Rapports & Exports")');
    await tabRapports.click();

    await expect(page.locator('text=Rapports & États d\'Exploitation')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=AREZKI BISSAU').first()).toBeVisible();
    await expect(page.locator('text=Ventilation par Catégorie de Véhicule')).toBeVisible();
    await expect(page.locator('text=Ventilation par Moyen de Paiement')).toBeVisible();
    await expect(page.locator('text=Le Responsable d\'Exploitation')).toBeVisible();

    // Vérifier la présence des boutons d'export
    await expect(page.locator('#btn-export-csv')).toBeVisible();
    await expect(page.locator('#btn-export-pdf')).toBeVisible();
  });
});
