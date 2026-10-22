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

  describe('Senegal Regional Formats (DK-XXXX-YY, ZG Casamance border, KD Kolda)', () => {
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

    it('should normalize Ziguinchor Casamance border plate (ZG-XXXX-YY)', () => {
      const result = normalizePlateText('ZG 7890 CC');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('ZG-7890-CC');
      expect(result?.country).toBe('SN');
    });

    it('should normalize Kolda border plate (KD-XXXX-YY)', () => {
      const result = normalizePlateText('KD 3456 DD');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('KD-3456-DD');
      expect(result?.country).toBe('SN');
    });
  });

  describe('International & Import Transit Formats (LL-NNN-LL, e.g. AB-093-FB)', () => {
    it('should normalize cleanly recognized import plate AB-093-FB', () => {
      const result = normalizePlateText('AB-093-FB');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('AB-093-FB');
      expect(result?.countryLabel).toBe('🌐 Transit / Import');
    });

    it('should correct glyph confusions on import plate (e.g. AB O93 FB with letter O)', () => {
      const result = normalizePlateText('AB O93 FB');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('AB-093-FB');
    });

    it('should normalize European format with dashes or spaces', () => {
      const result = normalizePlateText('EF 456 GH');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('EF-456-GH');
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
