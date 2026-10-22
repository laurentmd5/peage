import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.ts';

test.describe('Scénario E2E 5 : Cycle Complet de Session de Caisse (Ouverture, Rapprochement, Clôture)', () => {
  test('devrait ouvrir une session, opérer un encaissement et clôturer avec calcul d\'écart', async ({ page }) => {
    await loginAs(page, 'caissier2');

    // 1. Aller sur Gestion de Caisse
    const tabCaisse = page.locator('button:has-text("Gestion de Caisse")');
    await tabCaisse.click();

    // 2. Si un poste est déjà ouvert, le clôturer d'abord
    const btnTriggerClose = page.locator('#btn-trigger-close-session');
    if (await btnTriggerClose.isVisible()) {
      await btnTriggerClose.click();
      await page.locator('#btn-confirm-close-session').click();
      await expect(page.locator('text=Session Clôturée avec Succès')).toBeVisible();
      await page.locator('button:has-text("Ouvrir un nouveau poste")').click();
    }

    // 3. Ouvrir un nouveau poste
    await expect(page.locator('text=Ouverture d\'un Poste de Caisse')).toBeVisible();
    await page.locator('#select-open-booth').selectOption('CAISSE-02');
    await page.locator('#input-initial-float').fill('30000');
    await page.locator('#btn-confirm-open-session').click();

    // 4. Vérifier que la session est active
    await expect(page.locator('text=Session Active : CAISSE-02')).toBeVisible();

    // 5. Clôturer la session
    await page.locator('#btn-trigger-close-session').click();
    await expect(page.locator('text=Clôture et Rapprochement du Tiroir Caisse')).toBeVisible();

    // Saisir montant réel compté (avec un léger déficit de 500 F)
    await page.locator('#input-real-cash-counted').fill('29500');
    await page.locator('#btn-confirm-close-session').click();

    // 6. Vérifier la clôture et l'affichage de l'écart
    await expect(page.locator('text=Session Clôturée avec Succès')).toBeVisible();
    await expect(page.locator('text=Imprimer Fiche de Clôture PDF')).toBeVisible();
    await expect(page.locator('text=(Déficit)')).toBeVisible();
  });
});
