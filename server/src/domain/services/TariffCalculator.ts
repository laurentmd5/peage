import { TariffCategory } from '../entities/TariffCategory.ts';

export class TariffCalculator {
  static readonly DEFAULT_CATEGORIES: Array<{ code: string; label: string; rate: number }> = [
    { code: 'CAT1', label: 'Catégorie 1 (Motos, Tricycles & Taxis)', rate: 250 },
    { code: 'CAT2', label: 'Catégorie 2 (Voitures & Pick-up double cabine)', rate: 500 },
    { code: 'CAT3', label: 'Catégorie 3 (Canter, Bus & Mini-camions)', rate: 1500 },
    { code: 'CAT4', label: 'Catégorie 4 (Camions porteurs 7t à 20t)', rate: 5000 },
    { code: 'CAT5', label: 'Catégorie 5 (Semi-remorques & Trains routiers >20t)', rate: 10000 },
    { code: 'EXEMPT', label: 'Véhicule exempté (Secours / Police)', rate: 0 }
  ];

  calculateRate(category: TariffCategory): number {
    if (!category.isActive) {
      throw new Error(`La catégorie ${category.code} est actuellement désactivée`);
    }
    return category.currentRate;
  }

  calculateChange(amountDue: number, amountPaid: number): number {
    if (amountPaid < amountDue) {
      throw new Error(`Le montant reçu (${amountPaid} FCFA) est inférieur au tarif (${amountDue} FCFA)`);
    }
    return amountPaid - amountDue;
  }
}
