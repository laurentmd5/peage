import { describe, it, expect } from 'vitest';
import { TariffCategory } from '../../../server/src/domain/entities/TariffCategory.ts';

describe('TariffCategory Entity (DDD)', () => {
  it('should initialize with valid code, label, and rate', () => {
    const category = new TariffCategory('VL', 'Véhicule léger', 500);

    expect(category.code).toBe('VL');
    expect(category.label).toBe('Véhicule léger');
    expect(category.currentRate).toBe(500);
    expect(category.isActive).toBe(true);
    expect(category.history).toHaveLength(1);
    expect(category.history[0].rate).toBe(500);
    expect(category.history[0].reason).toBe('Tarif initial');
  });

  it('should reject negative rates', () => {
    expect(() => new TariffCategory('VL', 'Véhicule léger', -100)).toThrow('Le tarif ne peut pas être négatif');
  });

  it('should reject empty code or label', () => {
    expect(() => new TariffCategory('', 'Véhicule', 500)).toThrow('Le code de catégorie est obligatoire');
    expect(() => new TariffCategory('VL', '', 500)).toThrow('Le libellé de catégorie est obligatoire');
  });

  it('should update rate and add an entry in the history', () => {
    const category = new TariffCategory('VL', 'Véhicule léger', 500);

    category.updateRate(600, 'admin', 'Ajustement inflation 2026');

    expect(category.currentRate).toBe(600);
    expect(category.history).toHaveLength(2);
    expect(category.history[1].rate).toBe(600);
    expect(category.history[1].changedBy).toBe('admin');
    expect(category.history[1].reason).toBe('Ajustement inflation 2026');
  });

  it('should toggle active status', () => {
    const category = new TariffCategory('MOTO', 'Moto', 200);

    expect(category.isActive).toBe(true);
    category.toggleActive();
    expect(category.isActive).toBe(false);
    category.toggleActive();
    expect(category.isActive).toBe(true);
  });
});
