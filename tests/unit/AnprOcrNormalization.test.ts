import { describe, it, expect } from 'vitest';
import { normalizePlateText, disambiguateHMOnCanvas } from '../../client/src/services/anprOcrService.ts';

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

    it('should normalize truck plate AA-112-AA cleanly', () => {
      const result = normalizePlateText('AA-112-AA');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('AA-112-AA');
    });

    it('should extract AA-112-AA even with surrounding vehicle noise or multiline text', () => {
      const result = normalizePlateText('RENAULT\nAA-112-AA\nFH16');
      expect(result).not.toBeNull();
      expect(result?.plateNumber).toBe('AA-112-AA');
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

    it('should reject plates with invalid digit suffix (e.g. GB 124 4 or 1244)', () => {
      expect(normalizePlateText('GB 124 4')).toBeNull();
      expect(normalizePlateText('1244')).toBeNull();
      expect(normalizePlateText('GB-124-4')).toBeNull();
    });

    it('should cleanly extract international plate even with blue euro-band F and region code 75', () => {
      const res = normalizePlateText('F AB 093 FB 75');
      expect(res).not.toBeNull();
      expect(res?.plateNumber).toBe('AB-093-FB');
      expect(res?.countryLabel).toBe('🌐 Transit / Import');
    });

    it('should recover AA-112-AA when left Euroband clips or merges with first letter (A112AA, M-112-AA, A-T12-AA, LAL-112-AA, B112AA, I112AA, 1112AA, 8112AA)', () => {
      expect(normalizePlateText('A112AA')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('M-112-AA')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('A-T12-AA')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('LAL-112-AA 1')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('B112AA')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('I112AA')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('1112AA')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('8112AA')?.plateNumber).toBe('AA-112-AA');
      expect(normalizePlateText('BA112AA')?.plateNumber).toBe('AA-112-AA');
    });

    it('should reject pure-letter background wall words (e.g. TTASTHE, NETSYSTEME, VIDEOSURVEILLANCE, TEEEVI)', () => {
      expect(normalizePlateText('TTASTHE')).toBeNull();
      expect(normalizePlateText('NETSYSTEME')).toBeNull();
      expect(normalizePlateText('VIDEOSURVEILLANCE')).toBeNull();
      expect(normalizePlateText('SECURITE INFORMATIQUE')).toBeNull();
      expect(normalizePlateText('TEEEVI')).toBeNull();
      expect(normalizePlateText('BNSIIEA')).toBeNull();
      expect(normalizePlateText('IIEEEE')).toBeNull();
      expect(normalizePlateText('LEETEHE')).toBeNull();
      expect(normalizePlateText('2028 MC')).toBeNull();
      expect(normalizePlateText('10-26-2026 Mon 12:48:32')).toBeNull();
    });
  });

  describe('Topological H vs M Glyph Disambiguation (e.g. AA-331-CM misread as AA-331-CH)', () => {
    function createMockPlateCanvas(lastCharType: 'M' | 'H'): any {
      const W = 396;
      const H = 118;
      const margin = 18;
      const pw = W - margin * 2;
      const ph = H - margin * 2;
      const data = new Uint8ClampedArray(W * H * 4);
      data.fill(255); // White plate background

      const setPixel = (px: number, py: number, val = 10) => {
        const x = margin + px;
        const y = margin + py;
        if (x < 0 || x >= W || y < 0 || y >= H) return;
        const idx = (y * W + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      };

      // Draw 'C' at x = 230..250, y = 16..66 (left stem + top/bottom bars, no right stem)
      for (let y = 16; y <= 66; y++) {
        for (let x = 230; x <= 235; x++) setPixel(x, y);
      }
      for (let x = 230; x <= 250; x++) {
        for (let y = 16; y <= 21; y++) setPixel(x, y);
        for (let y = 61; y <= 66; y++) setPixel(x, y);
      }

      // Draw 'M' or 'H' at x = 262..286, y = 16..66
      for (let y = 16; y <= 66; y++) {
        // Left stem (262..266) and Right stem (282..286)
        for (let x = 262; x <= 266; x++) setPixel(x, y);
        for (let x = 282; x <= 286; x++) setPixel(x, y);
      }

      if (lastCharType === 'M') {
        // Upper V diagonals descending from top corners (y=16) to middle apex (x=274, y=42)
        for (let y = 16; y <= 42; y++) {
          const t = (y - 16) / (42 - 16);
          const lx = Math.round(265 + t * (274 - 265));
          const rx = Math.round(283 - t * (283 - 274));
          for (let dx = -2; dx <= 2; dx++) {
            setPixel(lx + dx, y);
            setPixel(rx + dx, y);
          }
        }
      } else {
        // Horizontal crossbar for H at y = 39..43
        for (let y = 39; y <= 43; y++) {
          for (let x = 266; x <= 282; x++) setPixel(x, y);
        }
      }

      return {
        width: W,
        height: H,
        getContext: () => ({
          getImageData: (sx: number, sy: number, sw: number, sh: number) => {
            const sub = new Uint8ClampedArray(sw * sh * 4);
            for (let y = 0; y < sh; y++) {
              for (let x = 0; x < sw; x++) {
                const srcIdx = ((sy + y) * W + (sx + x)) * 4;
                const dstIdx = (y * sw + x) * 4;
                sub[dstIdx] = data[srcIdx];
                sub[dstIdx + 1] = data[srcIdx + 1];
                sub[dstIdx + 2] = data[srcIdx + 2];
                sub[dstIdx + 3] = data[srcIdx + 3];
              }
            }
            return { data: sub };
          }
        })
      };
    }

    it('should correct AA-331-CH to AA-331-CM when the last glyph has upper V-diagonals of M', () => {
      const mockCanvasM = createMockPlateCanvas('M');
      expect(disambiguateHMOnCanvas(mockCanvasM, 'AA-331-CH')).toBe('AA-331-CM');
    });

    it('should preserve AA-331-CH when the last glyph is a symmetric H with only a middle crossbar', () => {
      const mockCanvasH = createMockPlateCanvas('H');
      expect(disambiguateHMOnCanvas(mockCanvasH, 'AA-331-CH')).toBe('AA-331-CH');
    });
  });
});
