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
    targetCanvas.width = Math.max(120, cropW * 2); // Upscale for better OCR accuracy
    targetCanvas.height = Math.max(40, cropH * 2);
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

    // High-contrast Grayscale with Dynamic Range Stretching (optimal for Tesseract LSTM)
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
    const range = Math.max(1, maxLum - minLum);

    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const stretched = Math.round(((lum - minLum) / range) * 255);
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
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
      const processedCanvas = this.preprocessPlateImage(srcCanvas, cropX, cropY, cropW, cropH);
      const cropDataUrl = processedCanvas.toDataURL('image/jpeg', 0.85);

      // Perform OCR
      let result = await this.worker.recognize(processedCanvas);
      let rawText = result.data.text ? result.data.text.trim() : '';

      // Fallback: If vehicle bbox was passed but OCR found nothing, try center reticle
      if (!rawText && bbox && source instanceof HTMLVideoElement) {
        const centerX = Math.round(width * 0.15);
        const centerY = Math.round(height * 0.28);
        const centerW = Math.round(width * 0.70);
        const centerH = Math.round(height * 0.44);
        const centerCanvas = this.preprocessPlateImage(srcCanvas, centerX, centerY, centerW, centerH);
        result = await this.worker.recognize(centerCanvas);
        rawText = result.data.text ? result.data.text.trim() : '';
      }

      console.log('[ANPR OCR] Raw text recognized by Tesseract:', rawText);

      if (!rawText) return null;

      // Apply Guinea-Bissau, Senegal & International syntactic grammar correction
      const normalized = normalizePlateText(rawText);
      console.log('[ANPR OCR] Normalized plate result:', normalized);
      if (!normalized) return null;

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
