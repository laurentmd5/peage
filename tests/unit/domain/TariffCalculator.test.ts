import { describe, it, expect } from 'vitest';
import { TariffCalculator } from '../../../server/src/domain/services/TariffCalculator.ts';
import { TariffCategory } from '../../../server/src/domain/entities/TariffCategory.ts';

describe('TariffCalculator Domain Service', () => {
  const calculator = new TariffCalculator();

  it('should return correct rate for active category', () => {
    const category = new TariffCategory('BUS', 'Bus', 1500);
    const rate = calculator.calculateRate(category);
    expect(rate).toBe(1500);
  });

  it('should throw when trying to calculate rate for deactivated category', () => {
    const category = new TariffCategory('BUS', 'Bus', 1500, false);
    expect(() => calculator.calculateRate(category)).toThrow('actuellement désactivée');
  });

  it('should calculate correct change when amount paid exceeds rate', () => {
    const change = calculator.calculateChange(500, 1000);
    expect(change).toBe(500);
  });

  it('should return 0 change when exact amount paid', () => {
    const change = calculator.calculateChange(500, 500);
    expect(change).toBe(0);
  });

  it('should throw when amount paid is less than rate', () => {
    expect(() => calculator.calculateChange(500, 300)).toThrow('inférieur au tarif');
  });

  it('should have all 6 default categories defined in specification (AREZKI BISSAU)', () => {
    const defaultCodes = TariffCalculator.DEFAULT_CATEGORIES.map(c => c.code);
    expect(defaultCodes).toEqual(['CAT1', 'CAT2', 'CAT3', 'CAT4', 'CAT5', 'EXEMPT']);

    const exempt = TariffCalculator.DEFAULT_CATEGORIES.find(c => c.code === 'EXEMPT');
    expect(exempt?.rate).toBe(0);

    const cat1 = TariffCalculator.DEFAULT_CATEGORIES.find(c => c.code === 'CAT1');
    expect(cat1?.rate).toBe(250);

    const cat2 = TariffCalculator.DEFAULT_CATEGORIES.find(c => c.code === 'CAT2');
    expect(cat2?.rate).toBe(500);

    const cat3 = TariffCalculator.DEFAULT_CATEGORIES.find(c => c.code === 'CAT3');
    expect(cat3?.rate).toBe(1500);

    const cat4 = TariffCalculator.DEFAULT_CATEGORIES.find(c => c.code === 'CAT4');
    expect(cat4?.rate).toBe(5000);

    const cat5 = TariffCalculator.DEFAULT_CATEGORIES.find(c => c.code === 'CAT5');
    expect(cat5?.rate).toBe(10000);
  });
});
