import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.ts';

test.describe('Scénario E2E 2 : Gestion des Tarifs & Historisation', () => {
  test('devrait basculer sur profil admin, modifier un tarif et vérifier l\'historisation', async ({ page }) => {
    await loginAs(page, 'admin');

    // Cliquer sur l'onglet "Gestion des Tarifs"
    const tabTarifs = page.locator('button:has-text("Gestion des Tarifs")');
    await tabTarifs.click();

    await expect(page.locator('text=Gestion de la Grille Tarifaire')).toBeVisible();

    // Cliquer sur le bouton modifier de la première catégorie
    const editBtn = page.locator('button[title="Modifier tarif"]').first();
    await editBtn.click();

    // Vérifier la modale de modification
    await expect(page.locator('text=Modifier le tarif')).toBeVisible();

    const inputRate = page.locator('#input-new-rate');
    await inputRate.fill('300');

    const inputReason = page.locator('#input-rate-reason');
    await inputReason.fill('Ajustement E2E révision temporaire');

    await page.locator('#btn-confirm-update-rate').click();

    // Vérifier la mise à jour à 300 FCFA
    await expect(page.locator('text=300 FCFA').first()).toBeVisible({ timeout: 5000 });

    // Rétablir immédiatement le tarif d'origine à 250 FCFA pour laisser la base de démo propre
    await editBtn.click();
    await expect(page.locator('text=Modifier le tarif')).toBeVisible();
    await inputRate.fill('250');
    await inputReason.fill('Rétablissement tarif officiel 250 FCFA');
    await page.locator('#btn-confirm-update-rate').click();

    // Vérifier le rétablissement à 250 FCFA
    await expect(page.locator('text=250 FCFA').first()).toBeVisible({ timeout: 5000 });
  });
});
