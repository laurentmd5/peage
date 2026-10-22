import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.ts';

test.describe('Scénario E2E 7 : Internationalisation & Bascule Bilingue (FR / EN)', () => {
  test('devrait permettre de basculer instantanément l\'interface entre Français et Anglais avec persistance', async ({ page }) => {
    await loginAs(page, 'admin');

    // 1. Vérifier état initial en Français
    await expect(page.locator('button:has-text("Poste de Caisse")')).toBeVisible();
    await expect(page.locator('button:has-text("Tableau de Bord")')).toBeVisible();
    await expect(page.locator('button:has-text("Gestion des Tarifs")')).toBeVisible();

    // 2. Basculer vers l'anglais via le sélecteur
    const btnLangEn = page.locator('#btn-lang-en');
    await expect(btnLangEn).toBeVisible();
    await btnLangEn.click();

    // 3. Vérifier la traduction immédiate des onglets et en-têtes
    await expect(page.locator('button:has-text("Toll Booth")')).toBeVisible();
    await expect(page.locator('button:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("Tariff Management")')).toBeVisible();
    await expect(page.locator('button:has-text("Cash Session")')).toBeVisible();
    await expect(page.locator('button:has-text("Reports & Exports")')).toBeVisible();
    await expect(page.locator('button:has-text("Audit Log")')).toBeVisible();

    // 4. Naviguer sur Dashboard en anglais
    await page.locator('button:has-text("Dashboard")').click();
    await expect(page.locator('text=Real-Time Supervision Dashboard')).toBeVisible();
    await expect(page.locator('text=Passages Today')).toBeVisible();
    await expect(page.locator('text=Daily Revenue')).toBeVisible();

    // 5. Naviguer sur Tariff Management en anglais
    await page.locator('button:has-text("Tariff Management")').click();
    await expect(page.locator('text=Tariff Grid Management')).toBeVisible();
    await expect(page.locator('text=New Category')).toBeVisible();

    // 6. Naviguer sur Toll Booth en anglais et vérifier l'affichage 100% anglophone Proforma AREZKI
    await page.locator('button:has-text("Toll Booth")').click();
    await expect(page.locator('text=AREZKI BISSAU').first()).toBeVisible();
    await expect(page.locator('text=Waiting for vehicle')).toBeVisible();
    await expect(page.locator('text=Taxi Bissau')).toBeVisible();
    await expect(page.locator('text=4MP ANPR CAM')).toBeVisible();
    await expect(page.locator('text=Inverter 230V')).toBeVisible();

    await page.screenshot({ path: 'screenshots/13_simulator_english.png', fullPage: true });

    // 7. Recharger la page pour vérifier la persistance de la langue
    await page.reload();
    await expect(page.locator('button:has-text("Toll Booth")')).toBeVisible();
    await expect(page.locator('text=Waiting for vehicle')).toBeVisible();

    // 8. Rebasculer en Français
    await page.locator('#btn-lang-fr').click();
    await expect(page.locator('button:has-text("Poste de Caisse")')).toBeVisible();
    await expect(page.locator('button:has-text("Tableau de Bord")')).toBeVisible();
    await expect(page.locator('text=En attente d\'un véhicule')).toBeVisible();
  });
});
