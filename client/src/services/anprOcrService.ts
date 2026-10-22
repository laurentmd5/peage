/**
 * ANPR / LAPI OCR Service for License Plate Recognition
 * Powered by Tesseract.js (WebAssembly / Web Worker)
 * Includes Region of Interest (ROI) extraction, binarization, and Guinea-Bissau / ECOWAS syntax normalization
 */

import { createWorker, Worker } from 'tesseract.js';

export interface PlateOcrResult {
  plateNumber: string;
  confidence: number;
  rawText: string;
  country: 'GW' | 'SN' | 'UNKNOWN';
  countryLabel: string;
  processedImageCrop?: string;
}

class AnprOcrService {
  private worker: Worker | null = null;
  private isInitializing = false;
  private initPromise: Promise<boolean> | null = null;

  /**
   * Initialize Tesseract Worker with Latin alphanumeric character whitelist
   */
  async init(): Promise<boolean> {
    if (this.worker) return true;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const worker = await createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ',
          tessedit_pageseg_mode: '7' as any // Treat image as a single text line (ideal for license plates)
        });
        this.worker = worker;
        this.isInitializing = false;
        console.log('[ANPR OCR] Tesseract Worker successfully initialized');
        return true;
      } catch (err) {
        console.warn('[ANPR OCR] Failed to initialize Tesseract Worker:', err);
        this.isInitializing = false;
        return false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Preprocess candidate license plate region (Grayscale + Adaptive Contrast Binarization)
   */
  preprocessPlateImage(
    sourceCanvas: HTMLCanvasElement,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number
  ): HTMLCanvasElement {
    const targetCanvas = document.createElement('canvas');
    // Upscale for optimal Tesseract LSTM character height (30-45px per character)
    targetCanvas.width = Math.max(300, cropW * 2);
    targetCanvas.height = Math.max(80, cropH * 2);
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return targetCanvas;

    // Enable high quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw upscaled crop
    ctx.drawImage(
      sourceCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, targetCanvas.width, targetCanvas.height
    );

    const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
    const data = imgData.data;

    // 1. Grayscale & Dynamic Range Stretching (optimal for Tesseract LSTM)
    let minLum = 255;
    let maxLum = 0;
    const gray = new Uint8ClampedArray(targetCanvas.width * targetCanvas.height);
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
      gray[i / 4] = Math.round(lum);
    }
    const range = Math.max(1, maxLum - minLum);

    // 2. Otsu's adaptive threshold calculation on stretched luminance
    const hist = new Uint32Array(256);
    let sum = 0;
    for (let i = 0; i < gray.length; i++) {
      const val = Math.round(((gray[i] - minLum) / range) * 255);
      gray[i] = val;
      hist[val]++;
      sum += val;
    }

    const total = gray.length;
    let sumB = 0;
    let wB = 0;
    let maxVariance = 0;
    let threshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;

      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVariance) {
        maxVariance = between;
        threshold = t;
      }
    }

    // Polarity check: count pixels below threshold
    let darkCount = 0;
    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < threshold) darkCount++;
    }

    // Standard plate: dark text on light background (< 55% dark pixels)
    // If background is dark (e.g. black car grille / dark bumper), invert so text is crisp black on white
    const invert = darkCount > (total * 0.55);

    for (let i = 0; i < data.length; i += 4) {
      const isChar = gray[i / 4] < threshold;
      const finalVal = invert ? (isChar ? 255 : 0) : (isChar ? 0 : 255);
      data[i] = finalVal;
      data[i + 1] = finalVal;
      data[i + 2] = finalVal;
    }

    ctx.putImageData(imgData, 0, 0);
    return targetCanvas;
  }

  /**
   * Recognize license plate text from a video element or canvas within a bounding box
   */
  async recognizePlate(
    source: HTMLVideoElement | HTMLCanvasElement,
    bbox?: [number, number, number, number]
  ): Promise<PlateOcrResult | null> {
    try {
      const ready = await this.init();
      if (!ready || !this.worker) return null;

      // Create snapshot canvas
      const srcCanvas = document.createElement('canvas');
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

      if (!width || !height) return null;
      srcCanvas.width = width;
      srcCanvas.height = height;

      const sCtx = srcCanvas.getContext('2d');
      if (!sCtx) return null;
      sCtx.drawImage(source, 0, 0);

      // Determine Plate Region of Interest (ROI)
      let cropX: number, cropY: number, cropW: number, cropH: number;

      if (bbox) {
        const [vx, vy, vw, vh] = bbox;
        // The license plate is typically in the lower portion of the detected vehicle
        cropX = Math.max(0, Math.round(vx + vw * 0.10));
        cropY = Math.max(0, Math.round(vy + vh * 0.45));
        cropW = Math.min(width - cropX, Math.round(vw * 0.80));
        cropH = Math.min(height - cropY, Math.round(vh * 0.50));
      } else if (source instanceof HTMLVideoElement) {
        // Target optical center region (Viseur LAPI) when presenting a plate in close-up
        cropX = Math.round(width * 0.15);
        cropY = Math.round(height * 0.28);
        cropW = Math.round(width * 0.70);
        cropH = Math.round(height * 0.44);
      } else {
        // If image itself is already cropped or standalone plate canvas, use entire canvas
        cropX = 0;
        cropY = 0;
        cropW = width;
        cropH = height;
      }

      if (cropW < 20 || cropH < 10) return null;

      // Preprocess crop
      let activeCanvas = this.preprocessPlateImage(srcCanvas, cropX, cropY, cropW, cropH);

      // Perform OCR
      let result = await this.worker.recognize(activeCanvas);
      let rawText = result.data.text ? result.data.text.trim() : '';
      let normalized = rawText ? normalizePlateText(rawText) : null;

      // Fallback 1: If vehicle bbox did not yield a valid plate, try the central optical reticle (Viseur LAPI)
      if (!normalized && bbox && source instanceof HTMLVideoElement) {
        const centerX = Math.round(width * 0.15);
        const centerY = Math.round(height * 0.25);
        const centerW = Math.round(width * 0.70);
        const centerH = Math.round(height * 0.50);
        const centerCanvas = this.preprocessPlateImage(srcCanvas, centerX, centerY, centerW, centerH);
        const centerResult = await this.worker.recognize(centerCanvas);
        const centerRaw = centerResult.data.text ? centerResult.data.text.trim() : '';
        const centerNorm = centerRaw ? normalizePlateText(centerRaw) : null;
        if (centerNorm) {
          result = centerResult;
          rawText = centerRaw;
          activeCanvas = centerCanvas;
          normalized = centerNorm;
        }
      }

      // Fallback 2: Try tight lower bumper plate bracket (lower 35% of vehicle bbox)
      if (!normalized && bbox && source instanceof HTMLVideoElement) {
        const [vx, vy, vw, vh] = bbox;
        const tightX = Math.max(0, Math.round(vx + vw * 0.15));
        const tightY = Math.max(0, Math.round(vy + vh * 0.60));
        const tightW = Math.min(width - tightX, Math.round(vw * 0.70));
        const tightH = Math.min(height - tightY, Math.round(vh * 0.35));
        if (tightW >= 30 && tightH >= 15) {
          const tightCanvas = this.preprocessPlateImage(srcCanvas, tightX, tightY, tightW, tightH);
          const tightResult = await this.worker.recognize(tightCanvas);
          const tightRaw = tightResult.data.text ? tightResult.data.text.trim() : '';
          const tightNorm = tightRaw ? normalizePlateText(tightRaw) : null;
          if (tightNorm) {
            result = tightResult;
            rawText = tightRaw;
            activeCanvas = tightCanvas;
            normalized = tightNorm;
          }
        }
      }

      console.log('[ANPR OCR] Raw text recognized by Tesseract:', rawText);
      console.log('[ANPR OCR] Normalized plate result:', normalized);

      if (!normalized) return null;

      const cropDataUrl = activeCanvas.toDataURL('image/jpeg', 0.85);
      return {
        ...normalized,
        rawText,
        processedImageCrop: cropDataUrl
      };
    } catch (err) {
      console.warn('[ANPR OCR] OCR extraction error:', err);
      return null;
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Normalizes and grammatically corrects OCR text to Guinea-Bissau (GB) or Senegal (DK) formats
 * Resolves standard OCR glyph confusions (e.g. 8 <-> B, 0 <-> O, 1 <-> I)
 */
export function normalizePlateText(raw: string): {
  plateNumber: string;
  confidence: number;
  country: 'GW' | 'SN' | 'UNKNOWN';
  countryLabel: string;
} | null {
  if (!raw) return null;

  // Clean all noise except alphanumeric
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 4) return null;

  // 1. Guinea-Bissau Match: GB + 3-4 digits + 1-2 letters
  // Handle frequent OCR confusions for "GB": G8, 6B, 68, CB, QB
  let gbCandidate = clean;
  if (/^(GB|G8|6B|68|CB|QB)/.test(gbCandidate)) {
    gbCandidate = 'GB' + gbCandidate.substring(2);
  }

  const gbPattern = /^GB([0-9OIZSBL]{3,4})([A-Z0-9]{1,2})$/;
  const gbMatch = gbCandidate.match(gbPattern);
  if (gbMatch) {
    const rawDigits = gbMatch[1];
    const rawLetters = gbMatch[2];

    // Force digits in the middle
    const correctedDigits = rawDigits
      .replace(/O/g, '0')
      .replace(/I|L/g, '1')
      .replace(/Z/g, '2')
      .replace(/S/g, '5')
      .replace(/B/g, '8');

    // Force letters in the suffix
    const correctedLetters = rawLetters
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/2/g, 'Z')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B');

    return {
      plateNumber: `GB-${correctedDigits}-${correctedLetters}`,
      confidence: 94,
      country: 'GW',
      countryLabel: '🇬🇼 Guinée-Bissau'
    };
  }

  // 2. Senegal Cross-Border Match: DK (Dakar), ZG (Ziguinchor Casamance), KD (Kolda), TH, KL
  // Handles frequent OCR confusions for "DK": 0K, OK, Dk; for "ZG": 2G, 7G
  let snPrefix: string | null = null;
  let snRemainder = clean;

  if (/^(DK|0K|OK)/i.test(snRemainder)) {
    snPrefix = 'DK';
    snRemainder = snRemainder.substring(2);
  } else if (/^(ZG|2G|7G)/i.test(snRemainder)) {
    snPrefix = 'ZG'; // Ziguinchor - principal point d'entrée transfrontalier Sénégal -> Guinée-Bissau
    snRemainder = snRemainder.substring(2);
  } else if (/^(KD|KO|K0)/i.test(snRemainder)) {
    snPrefix = 'KD'; // Kolda - frontière est Guinée-Bissau
    snRemainder = snRemainder.substring(2);
  } else if (/^(TH|KL|SL)/i.test(snRemainder)) {
    snPrefix = snRemainder.substring(0, 2).toUpperCase();
    snRemainder = snRemainder.substring(2);
  }

  if (snPrefix) {
    const snPattern = /^([0-9OIZSBL]{3,4})([A-Z0-9]{1,2})$/;
    const snMatch = snRemainder.match(snPattern);
    if (snMatch) {
      const rawDigits = snMatch[1];
      const rawLetters = snMatch[2];

      const correctedDigits = rawDigits
        .replace(/O/g, '0')
        .replace(/I|L/g, '1')
        .replace(/Z/g, '2')
        .replace(/S/g, '5')
        .replace(/B/g, '8');

      const correctedLetters = rawLetters
        .replace(/0/g, 'O')
        .replace(/1/g, 'I')
        .replace(/2/g, 'Z')
        .replace(/5/g, 'S')
        .replace(/8/g, 'B');

      return {
        plateNumber: `${snPrefix}-${correctedDigits}-${correctedLetters}`,
        confidence: 93,
        country: 'SN',
        countryLabel: '🇸🇳 Sénégal'
      };
    }
  }

  // 3. International / Import format: 2 letters - 3 digits - 2 letters (e.g. AB-093-FB, common imported "Venant" vehicles)
  const intlPattern = /^([A-Z0-9]{2})([0-9OIZSBL]{3})([A-Z0-9]{2})$/;
  const intlMatch = clean.match(intlPattern);
  if (intlMatch) {
    const rawPrefix = intlMatch[1];
    const rawDigits = intlMatch[2];
    const rawSuffix = intlMatch[3];

    // Correct prefix letters (avoid digits in prefix)
    const correctedPrefix = rawPrefix
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/2/g, 'Z')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B');

    // Correct middle digits
    const correctedDigits = rawDigits
      .replace(/O/g, '0')
      .replace(/I|L/g, '1')
      .replace(/Z/g, '2')
      .replace(/S/g, '5')
      .replace(/B/g, '8');

    // Correct suffix letters
    const correctedSuffix = rawSuffix
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/2/g, 'Z')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B');

    return {
      plateNumber: `${correctedPrefix}-${correctedDigits}-${correctedSuffix}`,
      confidence: 94,
      country: 'UNKNOWN',
      countryLabel: '🌐 Transit / Import'
    };
  }

  // 4. Unprefixed plate format: 3-4 digits + 1-2 letters (Defaults to Guinea-Bissau for AREZKI BISSAU plaza)
  const genericMatch = clean.match(/^([0-9OIZSBL]{3,4})([A-Z0-9]{1,2})$/);
  if (genericMatch) {
    const rawDigits = genericMatch[1];
    const rawLetters = genericMatch[2];

    const correctedDigits = rawDigits
      .replace(/O/g, '0')
      .replace(/I|L/g, '1')
      .replace(/Z/g, '2')
      .replace(/S/g, '5')
      .replace(/B/g, '8');

    const correctedLetters = rawLetters
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/2/g, 'Z')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B');

    return {
      plateNumber: `GB-${correctedDigits}-${correctedLetters}`,
      confidence: 88,
      country: 'GW',
      countryLabel: '🇬🇼 Guinée-Bissau'
    };
  }

  return null;
}

export const anprOcrService = new AnprOcrService();
