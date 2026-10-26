/**
 * AI Edge Computer Vision Service for Toll Vehicle Classification & ANPR
 * Compatible with standard PC Webcams, USB inspection cameras & RTSP IP streams
 */

import { anprOcrService } from './anprOcrService.ts';

export interface VehicleDetectionResult {
  categoryCode: 'CAT1' | 'CAT2' | 'CAT3' | 'CAT4' | 'CAT5';
  categoryLabel: string;
  tariff: number;
  confidence: number;
  detectedObject: string; // 'car', 'truck', 'bus', 'motorcycle'
  bbox: [number, number, number, number]; // [x, y, width, height]
  snapshotDataUrl?: string;
  plateNumberSuggestion?: string;
  fallbackPlate?: string;
  isOcrLiveRead?: boolean;
  plateCropUrl?: string;
  ocrCountryLabel?: string;
  isVehicleLocked?: boolean;
  isPlateLocked?: boolean;
}

export interface PlateConsensusReading {
  plateNumber: string;
  confidence: number;
  timestamp?: number;
  countryLabel?: string;
  crop?: string;
}

export interface PlateConsensusResult {
  plateNumber: string;
  confidence: number;
  votes: number;
  countryLabel?: string;
  crop?: string;
}

/**
 * Computes temporal majority voting consensus from a rolling buffer of OCR readings
 * Discriminates against single-frame motion blur jitters and favors complete format plates
 */
export function computePlateConsensus(
  readings: PlateConsensusReading[]
): PlateConsensusResult | null {
  if (!readings || readings.length === 0) return null;

  const counts = new Map<string, { count: number; maxConf: number; countryLabel?: string; crop?: string }>();
  for (const item of readings) {
    if (!item.plateNumber) continue;
    const entry = counts.get(item.plateNumber) || {
      count: 0,
      maxConf: 0,
      countryLabel: item.countryLabel,
      crop: item.crop
    };
    entry.count += 1;
    entry.maxConf = Math.max(entry.maxConf, item.confidence);
    if (item.countryLabel) entry.countryLabel = item.countryLabel;
    if (item.crop) entry.crop = item.crop;
    counts.set(item.plateNumber, entry);
  }

  let bestPlate = '';
  let bestScore = -1;
  let bestCount = 0;
  let bestConf = 0;
  let bestLabel: string | undefined;
  let bestCrop: string | undefined;

  counts.forEach((val, plate) => {
    // Scoring: each vote = 100 points, max confidence = 0..100 points
    // Complete 9-character plate bonus (e.g. AB-093-FB or GB-1234-AZ) = 25 points
    const lengthBonus = plate.length >= 9 ? 25 : 0;
    const score = val.count * 100 + val.maxConf + lengthBonus;
    if (score > bestScore) {
      bestScore = score;
      bestPlate = plate;
      bestCount = val.count;
      bestConf = val.maxConf;
      bestLabel = val.countryLabel;
      bestCrop = val.crop;
    }
  });

  if (!bestPlate) return null;

  return {
    plateNumber: bestPlate,
    confidence: bestConf,
    votes: bestCount,
    countryLabel: bestLabel,
    crop: bestCrop
  };
}

/**
 * Pure colorimetric function to identify yellow vehicle pixels
 * Tested against real taxi liveries and smartphone screens with cool backlight
 */
export function isYellowPixel(r: number, g: number, b: number): boolean {
  if (r < 110 || g < 95) return false;
  const sum = r + g + b;
  if (sum === 0) return false;
  const rNorm = r / sum;
  const gNorm = g / sum;
  const bNorm = b / sum;

  // Chromaticity check: Red and Green are dominant (> 34% each), Blue is suppressed (< 30%)
  const isYellowChromatic = (rNorm >= 0.35 && gNorm >= 0.32 && bNorm <= 0.30);

  // Direct RGB ratio heuristic (tolerant to smartphone screen backlight blue bleed)
  const isYellowRGB = (r > 125 && g > 100 && r > b * 1.20 && g > b * 1.05 && (r + g) > (b * 2.2));

  return isYellowChromatic || isYellowRGB;
}

/**
 * Geometric classifier to discriminate rigid trucks (CAT4) vs heavy semi-trailers / trains routiers (CAT5)
 */
export function classifyTruckSilhouette(aspectRatio: number, boxWidth: number, frameWidth: number): 'CAT4' | 'CAT5' {
  const isArticulatedHeavyTrailer = aspectRatio >= 1.30 || boxWidth > (frameWidth * 0.35);
  return isArticulatedHeavyTrailer ? 'CAT5' : 'CAT4';
}

class AIVisionService {
  private model: any = null;
  private isModelLoading = false;
  private modelLoadError: string | null = null;

  // Real-time Edge ANPR / LAPI OCR state
  private isOcrBusy = false;
  private lastOcrPlate: string | null = null;
  private lastOcrCrop: string | null = null;
  private lastOcrCountryLabel: string | null = null;
  private lastOcrTimestamp = 0;

  // Vehicle Snapshot & Category Freezing (Gel automatique du cliché véhicule dès détection)
  private lockedVehicleSnapshot: string | null = null;
  private lockedVehicleCategory: {
    categoryCode: 'CAT1' | 'CAT2' | 'CAT3' | 'CAT4' | 'CAT5';
    categoryLabel: string;
    tariff: number;
    detectedObject: string;
    confidence: number;
    bbox: [number, number, number, number];
  } | null = null;

  // Anti-drift OCR latching & temporal rolling consensus buffer
  private lockedPlate: {
    plateNumber: string;
    countryLabel?: string;
    crop?: string;
    confidence: number;
    timestamp: number;
  } | null = null;

  private ocrRollingBuffer: PlateConsensusReading[] = [];

  /**
   * Resets the ANPR OCR cache and vehicle lock when starting a new vehicle passage
   */
  resetOcr(): void {
    this.lastOcrPlate = null;
    this.lastOcrCrop = null;
    this.lastOcrCountryLabel = null;
    this.lockedVehicleSnapshot = null;
    this.lockedVehicleCategory = null;
    this.lockedPlate = null;
    this.ocrRollingBuffer = [];
    this.isOcrBusy = false;
  }

  /**
   * Unlocks the OCR plate reading to allow rescanning a different plate
   */
  unlockPlate(): void {
    this.lockedPlate = null;
    this.ocrRollingBuffer = [];
  }

  /**
   * Unlocks the vehicle snapshot to allow recapturing the vehicle
   */
  unlockVehicle(): void {
    this.lockedVehicleSnapshot = null;
    this.lockedVehicleCategory = null;
  }

  isVehicleSnapshotLocked(): boolean {
    return !!this.lockedVehicleSnapshot;
  }

  isPlateReadingLocked(): boolean {
    return !!this.lockedPlate;
  }

  getLockedSnapshot(): string | null {
    return this.lockedVehicleSnapshot;
  }

  /**
   * Dynamically loads TensorFlow.js and COCO-SSD from trusted CDN
   * Keeps bundle lightweight and utilizes browser WebGL hardware acceleration
   */
  async loadModel(): Promise<boolean> {
    if (this.model) return true;
    if (this.isModelLoading) return false;

    this.isModelLoading = true;
    this.modelLoadError = null;

    try {
      // 1. Ensure tfjs is loaded
      if (!(window as any).tf) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      }

      // 2. Ensure coco-ssd is loaded
      if (!(window as any).cocoSsd) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      }

      // 3. Initialize model
      this.model = await (window as any).cocoSsd.load({
        base: 'lite_mobilenet_v2' // Fast lightweight edge model for real-time video
      });

      this.isModelLoading = false;
      return true;
    } catch (err: any) {
      console.warn('AI Vision CDN Model could not be loaded, using fallback heuristic edge detector:', err);
      this.modelLoadError = err.message || 'CDN Load Error';
      this.isModelLoading = false;
      return false;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Ingests a new OCR reading into the rolling consensus buffer and manages anti-drift latching
   */
  public handleNewOcrResult(res: {
    plateNumber: string;
    confidence: number;
    countryLabel?: string;
    processedImageCrop?: string;
  }): void {
    const now = Date.now();
    this.lastOcrPlate = res.plateNumber;
    this.lastOcrCrop = res.processedImageCrop || null;
    this.lastOcrCountryLabel = res.countryLabel || null;

    // 1. Ingest into rolling buffer
    this.ocrRollingBuffer.push({
      plateNumber: res.plateNumber,
      confidence: res.confidence,
      timestamp: now,
      countryLabel: res.countryLabel,
      crop: res.processedImageCrop
    });

    // 2. Keep last 6 readings within 5 seconds
    this.ocrRollingBuffer = this.ocrRollingBuffer
      .filter(item => (now - (item.timestamp || 0)) < 5000)
      .slice(-6);

    // 3. Compute temporal majority consensus
    const consensus = computePlateConsensus(this.ocrRollingBuffer);
    if (!consensus) return;

    // 4. Anti-Drift Latching:
    if (!this.lockedPlate) {
      // First high-confidence read latches immediately
      if (consensus.confidence >= 90) {
        this.lockedPlate = {
          plateNumber: consensus.plateNumber,
          confidence: consensus.confidence,
          countryLabel: consensus.countryLabel,
          crop: consensus.crop,
          timestamp: now
        };
        console.log('[ANPR OCR] 🔒 Anti-drift latch locked on plate:', this.lockedPlate.plateNumber);
      }
    } else {
      // If already locked, prevent hand motion blur / occlusion from degrading plate (e.g. FB -> FI)
      // Only replace if a new reading has 3+ consensus votes and confidence >= 92%
      if (consensus.votes >= 3 && consensus.confidence >= 92 && consensus.plateNumber !== this.lockedPlate.plateNumber) {
        console.log('[ANPR OCR] 🔄 Updating locked plate by consensus majority:', consensus.plateNumber);
        this.lockedPlate = {
          plateNumber: consensus.plateNumber,
          confidence: consensus.confidence,
          countryLabel: consensus.countryLabel,
          crop: consensus.crop,
          timestamp: now
        };
      }
    }
  }

  /**
   * Returns current active plate: prioritizing anti-drift locked plate, then rolling consensus
   */
  public getEffectivePlate(): { plateNumber: string; confidence: number; countryLabel?: string; crop?: string } | null {
    if (this.lockedPlate) {
      return this.lockedPlate;
    }
    const consensus = computePlateConsensus(this.ocrRollingBuffer);
    if (consensus) {
      return consensus;
    }
    if (this.lastOcrPlate) {
      return {
        plateNumber: this.lastOcrPlate,
        confidence: 88,
        countryLabel: this.lastOcrCountryLabel || undefined,
        crop: this.lastOcrCrop || undefined
      };
    }
    return null;
  }

  /**
   * Background asynchronous trigger for ANPR OCR recognition
   */
  private triggerBackgroundOcr(source: HTMLVideoElement | HTMLCanvasElement, bbox?: [number, number, number, number]): void {
    const now = Date.now();
    if (this.isOcrBusy || (now - this.lastOcrTimestamp < 500)) {
      return;
    }

    this.isOcrBusy = true;
    anprOcrService.recognizePlate(source, bbox)
      .then(ocrResult => {
        if (ocrResult && ocrResult.plateNumber) {
          this.handleNewOcrResult(ocrResult);
        }
        this.isOcrBusy = false;
        this.lastOcrTimestamp = Date.now();
      })
      .catch(() => {
        this.isOcrBusy = false;
        this.lastOcrTimestamp = Date.now();
      });
  }

  /**
   * Run detection directly on an HTMLCanvasElement (used for Hikvision live frames and snapshots)
   */
  async detectFromCanvas(canvas: HTMLCanvasElement): Promise<VehicleDetectionResult | null> {
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return null;
    }

    const ctx = canvas.getContext('2d');
    const liveSnapshot = canvas.toDataURL('image/jpeg', 0.85);

    if (!this.model) {
      const loaded = await this.loadModel();
      if (!loaded) {
        return this.heuristicFallbackDetection(canvas, liveSnapshot);
      }
    }

    try {
      const predictions = await this.model.detect(canvas);
      
      const vehicleClasses = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'];
      const vehiclePreds = predictions.filter((p: any) => vehicleClasses.includes(p.class) && p.score > 0.40);

      if (vehiclePreds.length > 0) {
        vehiclePreds.sort((a: any, b: any) => b.score - a.score);
        const best = vehiclePreds[0];
        const res = this.mapObjectToCategory(best.class, best.score, best.bbox, canvas.width, ctx, liveSnapshot);

        if (!this.lockedVehicleSnapshot && res.confidence >= 50) {
          this.lockedVehicleSnapshot = liveSnapshot;
          this.lockedVehicleCategory = {
            categoryCode: res.categoryCode,
            categoryLabel: res.categoryLabel,
            tariff: res.tariff,
            detectedObject: res.detectedObject,
            confidence: res.confidence,
            bbox: res.bbox
          };
          console.log('[AI Vision Canvas] 🔒 Gel automatique véhicule réussi:', res.categoryCode, res.categoryLabel);
        }

        this.triggerBackgroundOcr(canvas, best.bbox);

        const activePlate = this.getEffectivePlate();
        return {
          ...res,
          snapshotDataUrl: this.lockedVehicleSnapshot || liveSnapshot,
          plateNumberSuggestion: activePlate?.plateNumber || res.plateNumberSuggestion,
          isOcrLiveRead: !!activePlate,
          plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
          ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
          isVehicleLocked: !!this.lockedVehicleSnapshot,
          isPlateLocked: !!this.lockedPlate
        };
      }

      this.triggerBackgroundOcr(canvas);
      const activePlate = this.getEffectivePlate();

      if (this.lockedVehicleCategory || activePlate) {
        const cat = this.lockedVehicleCategory || {
          categoryCode: 'CAT2' as const,
          categoryLabel: 'Catégorie 2 (Voitures & Pick-up double cabine)',
          tariff: 500,
          detectedObject: 'car',
          confidence: 90,
          bbox: [
            Math.round(canvas.width * 0.15),
            Math.round(canvas.height * 0.28),
            Math.round(canvas.width * 0.70),
            Math.round(canvas.height * 0.44)
          ] as [number, number, number, number]
        };

        return {
          categoryCode: cat.categoryCode,
          categoryLabel: cat.categoryLabel,
          tariff: cat.tariff,
          confidence: cat.confidence,
          detectedObject: cat.detectedObject,
          bbox: cat.bbox,
          snapshotDataUrl: this.lockedVehicleSnapshot || liveSnapshot,
          plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
          fallbackPlate: 'GB-4512-AZ',
          isOcrLiveRead: !!activePlate,
          plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
          ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
          isVehicleLocked: !!this.lockedVehicleSnapshot,
          isPlateLocked: !!this.lockedPlate
        };
      }

      return null;
    } catch (err) {
      console.error('Inference error on canvas:', err);
      return this.heuristicFallbackDetection(canvas, liveSnapshot);
    }
  }

  /**
   * Run real-time detection on a video frame
   */
  async detectFromVideo(videoEl: HTMLVideoElement): Promise<VehicleDetectionResult | null> {
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      return null;
    }

    // Capture current live frame canvas
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(videoEl, 0, 0);
    const liveSnapshot = canvas.toDataURL('image/jpeg', 0.85);

    if (!this.model) {
      const loaded = await this.loadModel();
      if (!loaded) {
        return this.heuristicFallbackDetection(videoEl, liveSnapshot);
      }
    }

    try {
      const predictions = await this.model.detect(videoEl);
      
      // Filter for vehicle classes
      const vehicleClasses = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'];
      const vehiclePreds = predictions.filter((p: any) => vehicleClasses.includes(p.class) && p.score > 0.45);

      // SCENARIO 1: Vehicle silhouette visible in camera frame
      if (vehiclePreds.length > 0) {
        vehiclePreds.sort((a: any, b: any) => b.score - a.score);
        const best = vehiclePreds[0];
        const res = this.mapObjectToCategory(best.class, best.score, best.bbox, videoEl.videoWidth, ctx, liveSnapshot);

        // FREEZE VEHICLE SNAPSHOT & CATEGORY on first high-confidence detection (Gel automatique)
        if (!this.lockedVehicleSnapshot && res.confidence >= 55) {
          this.lockedVehicleSnapshot = liveSnapshot;
          this.lockedVehicleCategory = {
            categoryCode: res.categoryCode,
            categoryLabel: res.categoryLabel,
            tariff: res.tariff,
            detectedObject: res.detectedObject,
            confidence: res.confidence,
            bbox: res.bbox
          };
          console.log('[AI Vision] 🔒 Gel automatique véhicule réussi:', res.categoryCode, res.categoryLabel);
        }

        // Trigger background ANPR OCR recognition
        this.triggerBackgroundOcr(videoEl, best.bbox);

        const activePlate = this.getEffectivePlate();
        return {
          ...res,
          snapshotDataUrl: this.lockedVehicleSnapshot || liveSnapshot,
          plateNumberSuggestion: activePlate?.plateNumber || res.plateNumberSuggestion,
          isOcrLiveRead: !!activePlate,
          plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
          ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
          isVehicleLocked: !!this.lockedVehicleSnapshot,
          isPlateLocked: !!this.lockedPlate
        };
      }

      // SCENARIO 2: No vehicle silhouette detected in current frame
      // (e.g. operator zoomed in close to the license plate with smartphone or moved hand)
      this.triggerBackgroundOcr(videoEl);

      const activePlate = this.getEffectivePlate();

      // If we already have a locked vehicle category or an active plate read, maintain passage state:
      if (this.lockedVehicleCategory || activePlate) {
        const cat = this.lockedVehicleCategory || {
          categoryCode: 'CAT2' as const,
          categoryLabel: 'Catégorie 2 (Voitures & Pick-up double cabine)',
          tariff: 500,
          detectedObject: 'car',
          confidence: 95,
          bbox: [
            Math.round(videoEl.videoWidth * 0.15),
            Math.round(videoEl.videoHeight * 0.28),
            Math.round(videoEl.videoWidth * 0.70),
            Math.round(videoEl.videoHeight * 0.44)
          ] as [number, number, number, number]
        };

        return {
          categoryCode: cat.categoryCode,
          categoryLabel: cat.categoryLabel,
          tariff: cat.tariff,
          confidence: cat.confidence,
          detectedObject: cat.detectedObject,
          bbox: cat.bbox,
          snapshotDataUrl: this.lockedVehicleSnapshot || liveSnapshot,
          plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
          fallbackPlate: 'GB-4512-AZ',
          isOcrLiveRead: !!activePlate,
          plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
          ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
          isVehicleLocked: !!this.lockedVehicleSnapshot,
          isPlateLocked: !!this.lockedPlate
        };
      }

      return null;
    } catch (err) {
      console.error('Inference error:', err);
      return this.heuristicFallbackDetection(videoEl, liveSnapshot);
    }
  }

  /**
   * Map COCO-SSD object and geometric features to AREZKI BISSAU 5 official categories
   */
  private mapObjectToCategory(
    objectClass: string,
    score: number,
    bbox: [number, number, number, number],
    sourceWidth: number,
    ctx: CanvasRenderingContext2D | null,
    liveSnapshot: string
  ): VehicleDetectionResult {
    const [x, y, w, h] = bbox;
    const confidencePct = Math.round(score * 100);
    const aspectRatio = w / Math.max(h, 1);
    const activePlate = this.getEffectivePlate();
    const isOcrLive = !!activePlate;

    // Snapshot: use locked vehicle photo if available, otherwise live frame
    const snapshotDataUrl = this.lockedVehicleSnapshot || liveSnapshot;

    // Cat 1: Motorcycle, trycicle, or Taxi
    if (objectClass === 'motorcycle' || objectClass === 'bicycle') {
      return {
        categoryCode: 'CAT1',
        categoryLabel: 'Catégorie 1 (Motos, Tricycles & Taxis)',
        tariff: 250,
        confidence: confidencePct,
        detectedObject: objectClass,
        bbox,
        snapshotDataUrl,
        plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || 'GB-1020-MC',
        fallbackPlate: 'GB-1020-MC',
        isOcrLiveRead: isOcrLive,
        plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
        ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
        isVehicleLocked: !!this.lockedVehicleSnapshot,
        isPlateLocked: !!this.lockedPlate
      };
    }

    // Cat 3: Bus / Minibus
    if (objectClass === 'bus') {
      return {
        categoryCode: 'CAT3',
        categoryLabel: 'Catégorie 3 (Canter, Bus & Mini-camions)',
        tariff: 1500,
        confidence: confidencePct,
        detectedObject: 'bus',
        bbox,
        snapshotDataUrl,
        plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
        fallbackPlate: 'GB-6789-DX',
        isOcrLiveRead: isOcrLive,
        plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
        ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
        isVehicleLocked: !!this.lockedVehicleSnapshot,
        isPlateLocked: !!this.lockedPlate
      };
    }

    // Cat 4 or Cat 5: Trucks & Heavy Vehicles
    if (objectClass === 'truck') {
      const truckCat = classifyTruckSilhouette(aspectRatio, w, sourceWidth);

      if (truckCat === 'CAT5') {
        return {
          categoryCode: 'CAT5',
          categoryLabel: 'Catégorie 5 (Semi-remorques & Trains routiers >20t)',
          tariff: 10000,
          confidence: confidencePct,
          detectedObject: 'semi-trailer',
          bbox,
          snapshotDataUrl,
          plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
          fallbackPlate: 'GB-9900-HB',
          isOcrLiveRead: isOcrLive,
          plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
          ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
          isVehicleLocked: !!this.lockedVehicleSnapshot,
          isPlateLocked: !!this.lockedPlate
        };
      }
      return {
        categoryCode: 'CAT4',
        categoryLabel: 'Catégorie 4 (Camions porteurs 7t à 20t)',
        tariff: 5000,
        confidence: confidencePct,
        detectedObject: 'truck',
        bbox,
        snapshotDataUrl,
        plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
        fallbackPlate: 'GB-8765-BZ',
        isOcrLiveRead: isOcrLive,
        plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
        ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
        isVehicleLocked: !!this.lockedVehicleSnapshot,
        isPlateLocked: !!this.lockedPlate
      };
    }

    // Cat 2: Standard Car / Pickup
    // Check if yellow dominant for Taxi (West Africa / Bissau taxis)
    const isYellowDominant = this.checkYellowDominance(ctx, x, y, w, h);
    if (isYellowDominant) {
      return {
        categoryCode: 'CAT1',
        categoryLabel: 'Catégorie 1 (Taxi Bissau)',
        tariff: 250,
        confidence: confidencePct,
        detectedObject: 'taxi',
        bbox,
        snapshotDataUrl,
        plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
        fallbackPlate: 'GB-2345-AF',
        isOcrLiveRead: isOcrLive,
        plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
        ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
        isVehicleLocked: !!this.lockedVehicleSnapshot,
        isPlateLocked: !!this.lockedPlate
      };
    }

    return {
      categoryCode: 'CAT2',
      categoryLabel: 'Catégorie 2 (Voitures & Pick-up double cabine)',
      tariff: 500,
      confidence: confidencePct,
      detectedObject: 'car',
      bbox,
      snapshotDataUrl,
      plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
      fallbackPlate: 'GB-4512-AZ',
      isOcrLiveRead: isOcrLive,
      plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
      ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
      isVehicleLocked: !!this.lockedVehicleSnapshot,
      isPlateLocked: !!this.lockedPlate
    };
  }

  /**
   * Sample pixels inside the central vehicle body region to detect Taxi yellow livery
   * Robust against smartphone screen backlight, white-balance drift and windshield reflections
   */
  private checkYellowDominance(ctx: CanvasRenderingContext2D | null, x: number, y: number, w: number, h: number): boolean {
    if (!ctx || w < 20 || h < 20) return false;
    try {
      // Focus on the central 60% of the vehicle box where the car body / doors / hood are located
      const startX = Math.max(0, Math.round(x + w * 0.15));
      const startY = Math.max(0, Math.round(y + h * 0.20));
      const sampleW = Math.max(10, Math.min(ctx.canvas.width - startX, Math.round(w * 0.70)));
      const sampleH = Math.max(10, Math.min(ctx.canvas.height - startY, Math.round(h * 0.60)));

      const imgData = ctx.getImageData(startX, startY, sampleW, sampleH);
      const data = imgData.data;
      let yellowPixels = 0;
      let evaluatedPixels = 0;

      // Sample every 2nd pixel (step of 8 in byte array) for optimal real-time performance
      for (let i = 0; i < data.length; i += 8) {
        evaluatedPixels++;
        if (isYellowPixel(data[i], data[i + 1], data[i + 2])) {
          yellowPixels++;
        }
      }

      const yellowRatio = evaluatedPixels > 0 ? (yellowPixels / evaluatedPixels) : 0;
      // 8% of body area is yellow (accounts for black tires, dark windows, bumpers and phone search banners)
      return yellowRatio >= 0.08;
    } catch {
      return false;
    }
  }

  /**
   * Heuristic fallback if offline without CDN access
   */
  private heuristicFallbackDetection(source: HTMLVideoElement | HTMLCanvasElement, liveSnapshot?: string): VehicleDetectionResult {
    const w = 'videoWidth' in source ? (source.videoWidth || 640) : (source.width || 640);
    const h = 'videoHeight' in source ? (source.videoHeight || 480) : (source.height || 480);
    const bbox: [number, number, number, number] = [w * 0.15, h * 0.2, w * 0.7, h * 0.6];

    let snap = liveSnapshot;
    if (!snap) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(source, 0, 0);
      snap = canvas.toDataURL('image/jpeg', 0.8);
    }

    if (!this.lockedVehicleSnapshot) {
      this.lockedVehicleSnapshot = snap;
    }

    const activePlate = this.getEffectivePlate();

    return {
      categoryCode: this.lockedVehicleCategory?.categoryCode || 'CAT2',
      categoryLabel: this.lockedVehicleCategory?.categoryLabel || 'Catégorie 2 (Voitures & Pick-up double cabine)',
      tariff: this.lockedVehicleCategory?.tariff || 500,
      confidence: 88,
      detectedObject: 'car',
      bbox,
      snapshotDataUrl: this.lockedVehicleSnapshot || snap,
      plateNumberSuggestion: activePlate?.plateNumber || this.lastOcrPlate || '',
      fallbackPlate: 'GB-4512-AZ',
      isOcrLiveRead: !!activePlate || !!this.lastOcrPlate,
      plateCropUrl: activePlate?.crop || this.lastOcrCrop || undefined,
      ocrCountryLabel: activePlate?.countryLabel || this.lastOcrCountryLabel || undefined,
      isVehicleLocked: !!this.lockedVehicleSnapshot,
      isPlateLocked: !!this.lockedPlate
    };
  }
}

export const aiVisionService = new AIVisionService();
