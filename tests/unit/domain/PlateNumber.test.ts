import { describe, it, expect } from 'vitest';
import { PlateNumber } from '../../../server/src/domain/value-objects/PlateNumber.ts';

describe('PlateNumber Value Object', () => {
  it('should normalize plate string to uppercase and trimmed', () => {
    const plate = new PlateNumber('  ab-123-cd  ', 92);
    expect(plate.value).toBe('AB-123-CD');
    expect(plate.confidence).toBe(92);
  });

  it('should reject invalid or too short plate string', () => {
    expect(() => new PlateNumber('', 90)).toThrow("Plaque d'immatriculation invalide");
    expect(() => new PlateNumber('A', 90)).toThrow("Plaque d'immatriculation invalide");
  });

  it('should reject confidence outside 0-100', () => {
    expect(() => new PlateNumber('AB-123-CD', -5)).toThrow('Score de confiance invalide');
    expect(() => new PlateNumber('AB-123-CD', 105)).toThrow('Score de confiance invalide');
  });

  it('should properly compare two plate numbers', () => {
    const p1 = new PlateNumber('DK-1234-AA', 90);
    const p2 = new PlateNumber('dk-1234-aa', 95);
    const p3 = new PlateNumber('TH-9012-CC', 90);

    expect(p1.equals(p2)).toBe(true);
    expect(p1.equals(p3)).toBe(false);
  });

  it('should format and recognize Senegal Dakar DK plates', () => {
    const dk1 = new PlateNumber('dk-1234-aa', 95);
    expect(dk1.value).toBe('DK-1234-AA');
    expect(dk1.isSenegalDk).toBe(true);

    const dk2 = new PlateNumber('DK 5678 BB', 90);
    expect(dk2.value).toBe('DK-5678-BB');
    expect(dk2.isSenegalDk).toBe(true);

    const dk3 = new PlateNumber('DK9012CC', 90);
    expect(dk3.value).toBe('DK-9012-CC');
    expect(dk3.isSenegalDk).toBe(true);

    const dk4 = new PlateNumber('4321-AH', 88);
    expect(dk4.value).toBe('DK-4321-AH');
    expect(dk4.isSenegalDk).toBe(true);

    expect(PlateNumber.isValidSenegalDk('DK-1234-AA')).toBe(true);
    expect(PlateNumber.isValidSenegalDk('dk 1234 aa')).toBe(true);
    expect(PlateNumber.isValidSenegalDk('FR-999-ZZ')).toBe(false);
  });

  it('should generate valid random Senegal Dakar DK plates', () => {
    const generated = PlateNumber.generateRandomSenegalDk();
    expect(PlateNumber.isValidSenegalDk(generated)).toBe(true);
    expect(generated.startsWith('DK-')).toBe(true);
  });

  it('should format and recognize Guinea-Bissau GB plates for Arezki Bissau', () => {
    const gb1 = new PlateNumber('gb-2345-af', 96);
    expect(gb1.value).toBe('GB-2345-AF');
    expect(gb1.isGuineaBissau).toBe(true);

    const gb2 = new PlateNumber('GB 8765 BZ', 91);
    expect(gb2.value).toBe('GB-8765-BZ');
    expect(gb2.isGuineaBissau).toBe(true);

    expect(PlateNumber.isValidGuineaBissau('GB-1234-AB')).toBe(true);
    expect(PlateNumber.isValidGuineaBissau('DK-1234-AA')).toBe(false);

    const generatedGb = PlateNumber.generateRandomGuineaBissau();
    expect(PlateNumber.isValidGuineaBissau(generatedGb)).toBe(true);
    expect(generatedGb.startsWith('GB-')).toBe(true);
  });
});
