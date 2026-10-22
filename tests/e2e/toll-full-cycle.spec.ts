import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.ts';

test.describe('Scénario E2E 1 : Cycle Complet de Péage Automatisé', () => {
  test('devrait effectuer le cycle complet : Détection -> ANPR -> Paiement Espèces -> Reçu PDF & Barrière', async ({ page }) => {
    // 1. Connexion en caissier 1
    await loginAs(page, 'caissier1');

    // 2. Vérifier l'arrivée sur le poste de caisse
    await expect(page.locator('text=En attente d\'un véhicule')).toBeVisible({ timeout: 10000 });

    // 3. Déclencher la détection d'un véhicule (ANPR)
    const btnSimulate = page.locator('#btn-simulate-arrival');
    await expect(btnSimulate).toBeVisible();
    await btnSimulate.click();

    // 4. Vérifier l'écran de détection ANPR
    await expect(page.locator('text=Véhicule Détecté (Lecture ANPR)')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Confiance :')).toBeVisible();

    // 5. Cliquer sur "Procéder au paiement"
    const btnProceed = page.locator('#btn-proceed-payment');
    await expect(btnProceed).toBeVisible();
    await btnProceed.click();

    // 6. Vérifier l'écran de paiement
    await expect(page.locator('text=Encaissement du Péage')).toBeVisible();
    await expect(page.locator('text=Moyen de paiement')).toBeVisible();

    // Saisir le montant en espèces (suffisant pour couvrir toute catégorie jusqu'à 10 000 FCFA)
    const cashInput = page.locator('#input-cash-amount');
    await expect(cashInput).toBeVisible();
    await cashInput.fill('10000');

    // Valider le paiement
    const btnValidate = page.locator('#btn-validate-payment');
    await expect(btnValidate).toBeVisible();
    await btnValidate.click();

    // 7. Vérifier la validation, l'ouverture de barrière et le bouton de reçu
    await expect(page.locator('text=Paiement Validé avec Succès')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('OUVERTE', { exact: true })).toBeVisible();

    const btnReceipt = page.locator('#btn-download-receipt');
    await expect(btnReceipt).toBeVisible();

    // 8. Passer au véhicule suivant
    const btnNext = page.locator('#btn-next-vehicle');
    await expect(btnNext).toBeVisible();
    await btnNext.click();

    await expect(page.locator('text=En attente d\'un véhicule')).toBeVisible();
  });
});
