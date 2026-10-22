import { describe, it, expect } from 'vitest';
import { isYellowPixel, classifyTruckSilhouette, computePlateConsensus, aiVisionService } from '../../client/src/services/aiVisionService.ts';

describe('AI Vision Edge Heuristics & Vehicle Classification Rules', () => {
  describe('Taxi Yellow Livery Colorimetry (isYellowPixel)', () => {
    it('should detect pure yellow car paint', () => {
      // Classic yellow paint: high R, high G, low B
      const result = isYellowPixel(230, 200, 30);
      expect(result).toBe(true);
    });

    it('should detect taxi yellow even under smartphone screen backlight with blue bleed', () => {
      // OLED / LCD screen displaying yellow taxi with cold ~6500K backlight bleed:
      // R=205, G=180, B=115
      const result = isYellowPixel(205, 180, 115);
      expect(result).toBe(true);
    });

    it('should detect African urban taxi yellow (Bissau / Dakar warm ochre livery)', () => {
      // Warm yellow/ochre taxi livery
      const result = isYellowPixel(210, 165, 45);
      expect(result).toBe(true);
    });

    it('should NOT classify white cars as yellow', () => {
      // Pure white or off-white vehicle
      const result = isYellowPixel(240, 240, 240);
      expect(result).toBe(false);
    });

    it('should NOT classify metallic grey or silver cars as yellow', () => {
      // Silver metallic body
      const result = isYellowPixel(160, 160, 165);
      expect(result).toBe(false);
    });

    it('should NOT classify black or dark shadow pixels as yellow', () => {
      // Dark tires, shadows, chassis
      const result = isYellowPixel(30, 30, 35);
      expect(result).toBe(false);
    });

    it('should NOT classify red cars as yellow', () => {
      // Red car body
      const result = isYellowPixel(220, 40, 40);
      expect(result).toBe(false);
    });

    it('should NOT classify green or cyan cars as yellow', () => {
      // Green livery
      const result = isYellowPixel(40, 200, 60);
      expect(result).toBe(false);
    });
  });

  describe('Heavy Vehicle Silhouette Discrimination (classifyTruckSilhouette)', () => {
    it('should classify elongated semi-trailers in 3/4 perspective as CAT5 (10 000 FCFA)', () => {
      // Volvo tractor + semi-trailer shown in 3/4 perspective (aspect ratio ~1.45, occupying 35% of frame)
      const cat = classifyTruckSilhouette(1.45, 230, 640);
      expect(cat).toBe('CAT5');
    });

    it('should classify wide container trailer / road train as CAT5 (10 000 FCFA)', () => {
      // Wide profile semi-trailer or train routier
      const cat = classifyTruckSilhouette(1.80, 300, 640);
      expect(cat).toBe('CAT5');
    });

    it('should classify compact rigid trucks (7t to 20t) as CAT4 (5 000 FCFA)', () => {
      // 2-axle rigid dump truck / box truck seen from front or compact 3/4 (aspect ratio 1.15, width 150px)
      const cat = classifyTruckSilhouette(1.15, 150, 640);
      expect(cat).toBe('CAT4');
    });

    it('should classify tall boxy carrier trucks as CAT4 (5 000 FCFA)', () => {
      // Standard rigid distribution truck (aspect ratio 1.20, width 180px in 640px frame)
      const cat = classifyTruckSilhouette(1.20, 180, 640);
      expect(cat).toBe('CAT4');
    });
  });

  describe('Temporal Rolling Consensus & Anti-Drift Buffer (computePlateConsensus)', () => {
    it('should return null for empty readings buffer', () => {
      expect(computePlateConsensus([])).toBeNull();
    });

    it('should pick candidate with majority votes across consecutive video frames', () => {
      const readings = [
        { plateNumber: 'AB-093-FB', confidence: 94 },
        { plateNumber: 'AB-693-FB', confidence: 91 },
        { plateNumber: 'AB-093-FB', confidence: 95 },
        { plateNumber: 'AB-093-FB', confidence: 93 }
      ];

      const consensus = computePlateConsensus(readings);
      expect(consensus).not.toBeNull();
      expect(consensus?.plateNumber).toBe('AB-093-FB');
      expect(consensus?.votes).toBe(3);
    });

    it('should protect against hand motion suffix degradation (FB -> FI)', () => {
      // Operator hand motion right before clicking: stable reading AB-693-FB followed by occluded FI
      const readings = [
        { plateNumber: 'AB-693-FB', confidence: 94 },
        { plateNumber: 'AB-693-FB', confidence: 94 },
        { plateNumber: 'AB-693-FI', confidence: 84 }
      ];

      const consensus = computePlateConsensus(readings);
      expect(consensus).not.toBeNull();
      expect(consensus?.plateNumber).toBe('AB-693-FB');
      expect(consensus?.votes).toBe(2);
    });

    it('should grant length bonus to complete 9-character plates over truncated readings', () => {
      const readings = [
        { plateNumber: 'AB-093-FB', confidence: 90 }, // complete 9-char
        { plateNumber: 'AB-093', confidence: 91 }     // truncated 6-char
      ];

      const consensus = computePlateConsensus(readings);
      expect(consensus).not.toBeNull();
      expect(consensus?.plateNumber).toBe('AB-093-FB');
    });

    it('should allow aiVisionService to manage plate locks and reset state cleanly', () => {
      aiVisionService.resetOcr();
      expect(aiVisionService.isPlateReadingLocked()).toBe(false);
      expect(aiVisionService.isVehicleSnapshotLocked()).toBe(false);
      expect(aiVisionService.getLockedSnapshot()).toBeNull();

      // Ingest high-confidence read -> latches automatically
      aiVisionService.handleNewOcrResult({
        plateNumber: 'AB-093-FB',
        confidence: 94,
        countryLabel: '🌐 Transit / Import'
      });

      expect(aiVisionService.isPlateReadingLocked()).toBe(true);
      expect(aiVisionService.getEffectivePlate()?.plateNumber).toBe('AB-093-FB');

      // Hand motion degradation reading (e.g. single frame AB-093-FI) does NOT degrade locked reading
      aiVisionService.handleNewOcrResult({
        plateNumber: 'AB-093-FI',
        confidence: 86
      });
      expect(aiVisionService.getEffectivePlate()?.plateNumber).toBe('AB-093-FB');

      // Unlocking plate clears lock
      aiVisionService.unlockPlate();
      expect(aiVisionService.isPlateReadingLocked()).toBe(false);
    });
  });
});
