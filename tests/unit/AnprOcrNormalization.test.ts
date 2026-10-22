import { describe, it, expect } from 'vitest';
import { normalizePlateText } from '../../client/src/services/anprOcrService.ts';

describe('ANPR / LAPI OCR Plate Normalization & Grammar Correction', () => {
  describe('Guinea-Bissau Official Formats (GB-XXXX-YY)', () => {
    it('should normalize cleanly recognized Guinea-Bissau plate', () => {
      const result = normalizePlateText('GB-4512-AZ');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('GB-4512-AZ');
      expect(result?.country).toBe('GW');
    });

    it('should correct "G8" OCR confusion to "GB"', () => {
      const result = normalizePlateText('G8 4512 AZ');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('GB-4512-AZ');
    });

    it('should correct "6B" OCR confusion to "GB"', () => {
      const result = normalizePlateText('6B 2345 AF');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('GB-2345-AF');
    });

    it('should correct letter "O" to digit "0" in numerical plate body', () => {
      const result = normalizePlateText('GB-45O2-AZ');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('GB-4502-AZ');
    });

    it('should correct letter "I" or "L" to digit "1" in numerical plate body', () => {
      const result = normalizePlateText('GB 45I2 AZ');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('GB-4512-AZ');
    });

    it('should correct digit "0" to letter "O" in suffix series', () => {
      const result = normalizePlateText('GB 8765 B0');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('GB-8765-BO');
    });
  });

  describe('Senegal Regional Formats (DK-XXXX-YY)', () => {
    it('should normalize cleanly recognized Dakar plate', () => {
      const result = normalizePlateText('DK 1234 AA');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('DK-1234-AA');
      expect(result?.country).toBe('SN');
    });

    it('should correct "0K" or "OK" to "DK"', () => {
      const result = normalizePlateText('0K-5678-BB');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('DK-5678-BB');
      expect(result?.country).toBe('SN');
    });
  });

  describe('Unprefixed Short Formats (defaults to Plaza Guinea-Bissau GB)', () => {
    it('should normalize 4 digits + 2 letters to Guinea-Bissau standard', () => {
      const result = normalizePlateText('4512 AZ');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('GB-4512-AZ');
      expect(result?.country).toBe('GW');
    });
  });

  describe('Noise and Invalid Input Rejection', () => {
    it('should reject short noise strings', () => {
      expect(normalizePlateText('ABC')).toBeNull();
      expect(normalizePlateText('')).toBeNull();
    });

    it('should reject non-plate strings', () => {
      expect(normalizePlateText('VOLVO TRUCK 500')).toBeNull();
    });
  });
});
