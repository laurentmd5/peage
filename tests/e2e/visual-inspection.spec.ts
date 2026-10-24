import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Inspection Visuelle Complète de l\'Interface (Playwright)', () => {
  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Inspection visuelle exhaustive de tous les écrans et états du système', async ({ page }) => {
    test.setTimeout(60000);
    // Définir une résolution standard de poste de travail péage (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });

    // ==========================================
    // ÉCRAN 1 : LOGIN & ACCÈS RAPIDE PROFILS
    // ==========================================
    await page.goto('/');
    await expect(page.locator('text=SYSTÈME DE PÉAGE AUTOMATISÉ')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '01_login_screen.png'), fullPage: true });

    // Connexion en Caissier 1
    await page.locator('#btn-quick-caissier1').click();
    await expect(page.locator('text=AREZKI BISSAU').first()).toBeVisible();

    // ==========================================
    // ÉCRAN 2 : POSTE DE CAISSE - EN ATTENTE
    // ==========================================
    await expect(page.locator('text=En attente d\'un véhicule')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '02_poste_caisse_attente.png'), fullPage: true });

    // ==========================================
    // ÉCRAN 3 : DÉTECTION VÉHICULE & ANPR
    // ==========================================
    const btnSimulate = page.locator('#btn-simulate-arrival');
    await btnSimulate.click();
    await expect(page.locator('text=Véhicule Détecté (Lecture ANPR)')).toBeVisible();
    await expect(page.locator('text=Confiance :')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '03_poste_caisse_anpr_detecte.png'), fullPage: true });

    // ==========================================
    // ÉCRAN 4 : ENCAISSEMENT & SÉLECTION PAIEMENT
    // ==========================================
    await page.locator('#btn-proceed-payment').click();
    await expect(page.locator('text=Encaissement du Péage')).toBeVisible();
    await expect(page.locator('text=Touches rapides billets :')).toBeVisible();

    // Saisie d'un montant suffisant (10 000 FCFA) pour couvrir toute catégorie et observer le calcul de monnaie rendue
    await page.locator('#input-cash-amount').fill('10000');
    await page.screenshot({ path: path.join(screenshotsDir, '04_poste_caisse_paiement_especes.png'), fullPage: true });

    // ==========================================
    // ÉCRAN 5 : VALIDATION, REÇU & BARRIÈRE OUVERTE
    // ==========================================
    await page.locator('#btn-validate-payment').click();
    await expect(page.locator('text=Paiement Validé avec Succès')).toBeVisible();
    await expect(page.getByText('OUVERTE', { exact: true })).toBeVisible();
    await expect(page.locator('#btn-download-receipt')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '05_poste_caisse_validation_barriere_ouverte.png'), fullPage: true });

    // Réinitialisation vers le véhicule suivant
    await page.locator('#btn-next-vehicle').click();
    await expect(page.locator('text=En attente d\'un véhicule')).toBeVisible();

    // ==========================================
    // ÉCRAN 6 : TABLEAU DE BORD TEMPS RÉEL (SUPERVISION)
    // ==========================================
    await page.locator('button:has-text("Tableau de Bord")').click();
    await expect(page.locator('text=Tableau de Bord Supervision Temps Réel')).toBeVisible();
    await expect(page.locator('text=Passages Aujourd\'hui')).toBeVisible();
    await expect(page.locator('text=Recettes du Jour')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '06_dashboard_supervision.png'), fullPage: true });

    // ==========================================
    // ÉCRAN 7 : REGISTRE DES TRANSACTIONS
    // ==========================================
    await page.locator('button:has-text("Transactions")').click();
    await expect(page.locator('text=Registre des Transactions')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '07_registre_transactions.png'), fullPage: true });

    // Recherche par plaque
    await page.locator('#input-search-plate').fill('DK');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '07b_transactions_recherche_plaque.png'), fullPage: true });
    await page.locator('#input-search-plate').fill('');

    // ==========================================
    // ÉCRAN 8 : GESTION DES TARIFS (PROFIL ADMIN)
    // ==========================================
    // Bascule en profil Admin
    await page.locator('text=Admin').first().click();
    await page.locator('button:has-text("Gestion des Tarifs")').click();
    await expect(page.locator('text=Gestion de la Grille Tarifaire')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '08_gestion_tarifs.png'), fullPage: true });

    // Ouvrir l'historique d'une catégorie
    await page.locator('button:has-text("révision(s)")').first().click();
    await expect(page.locator('text=Historique des Révisions')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '08b_historique_revisions_tarif.png') });
    await page.evaluate(() => (document.getElementById('btn-close-modal') as HTMLElement)?.click());
    await expect(page.locator('text=Historique des Révisions')).toBeHidden();

    // ==========================================
    // ÉCRAN 9 : GESTION DE CAISSE
    // ==========================================
    await page.locator('button:has-text("Gestion de Caisse")').click();
    await expect(page.locator('text=Gestion de Session de Caisse')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '09_gestion_caisse.png'), fullPage: true });

    // ==========================================
    // ÉCRAN 10 : RAPPORTS & ÉTATS D'EXPLOITATION
    // ==========================================
    await page.locator('button:has-text("Rapports & Exports")').click();
    await expect(page.locator('text=Rapports & États d\'Exploitation')).toBeVisible();
    await expect(page.locator('text=AREZKI BISSAU').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '10_rapport_officiel_exploitation.png'), fullPage: true });

    // ==========================================
    // ÉCRAN 11 : JOURNAL D'AUDIT & TRAÇABILITÉ
    // ==========================================
    await page.locator('button:has-text("Journal d\'Audit")').click();
    await expect(page.locator('text=Journal d\'Audit & Traçabilité Réglementaire')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '11_journal_audit_securite.png'), fullPage: true });

    // ==========================================
    // ÉCRAN 12 : RETOUR POSTE DE CAISSE & VOIE COMPLÈTE
    // ==========================================
    await page.locator('button:has-text("Poste de Caisse")').click();
    await expect(page.locator('text=Poste de Caisse').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '12_poste_caisse_complet.png'), fullPage: true });
  });
});
