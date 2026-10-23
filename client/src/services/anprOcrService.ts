/**
 * Client-Side Edge ANPR / LAPI OCR Service
 * Powered by WebAssembly Tesseract.js Worker
 * Grammatical correction for Guinea-Bissau (GB) and West African / CEDEAO plates
 */

import { createWorker, Worker } from 'tesseract.js';

export interface PlateOcrResult {
  plateNumber: string;
  confidence: number;
  country: 'GW' | 'SN' | 'UNKNOWN';
  countryLabel: string;
  rawText: string;
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
   * Searches for a high-luminance horizontal plate cluster within a candidate region
   * Prevents dark car grilles and bumpers from contaminating the plate bounding box
   */
  findPlateSubcrop(
    sourceCanvas: HTMLCanvasElement,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): { x: number; y: number; w: number; h: number } {
    if (rw < 60 || rh < 20) return { x: rx, y: ry, w: rw, h: rh };

    try {
      const c = document.createElement('canvas');
      c.width = rw;
      c.height = rh;
      const ctx = c.getContext('2d');
      if (!ctx) return { x: rx, y: ry, w: rw, h: rh };
      ctx.drawImage(sourceCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
      const data = ctx.getImageData(0, 0, rw, rh).data;

      const rowBright = new Int32Array(rh);
      for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
          const idx = (y * rw + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum > 155) rowBright[y]++;
        }
      }

      let bestStartY = -1;
      let bestEndY = -1;
      let maxRun = 0;
      let curRun = 0;
      let curStart = -1;

      for (let y = 0; y < rh; y++) {
        if (rowBright[y] > rw * 0.15) {
          if (curStart === -1) curStart = y;
          curRun++;
          if (curRun > maxRun) {
            maxRun = curRun;
            bestStartY = curStart;
            bestEndY = y;
          }
        } else {
          curStart = -1;
          curRun = 0;
        }
      }

      if (maxRun >= 14 && bestStartY !== -1) {
        const padY = Math.round(maxRun * 0.15);
        const py = Math.max(0, bestStartY - padY);
        const ph = Math.min(rh - py, (bestEndY - bestStartY) + padY * 2);

        const colBright = new Int32Array(rw);
        for (let y = bestStartY; y <= bestEndY; y++) {
          for (let x = 0; x < rw; x++) {
            const idx = (y * rw + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (lum > 155) colBright[x]++;
          }
        }

        let minX = rw;
        let maxX = 0;
        for (let x = 0; x < rw; x++) {
          if (colBright[x] > (bestEndY - bestStartY) * 0.18) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }

        const candidateW = maxX - minX;
        const candidateH = bestEndY - bestStartY;
        // Verify realistic aspect ratio & min dimensions for a vehicle license plate
        if (candidateW >= 60 && candidateH >= 14 && candidateW > candidateH * 1.4) {
          const padX = Math.round(candidateW * 0.05);
          const px = Math.max(0, minX - padX);
          const pw = Math.min(rw - px, candidateW + padX * 2);
          return { x: rx + px, y: ry + py, w: pw, h: ph };
        }
      }
    } catch {
      // Fallback on error
    }

    return { x: rx, y: ry, w: rw, h: rh };
  }

  /**
   * Preprocess candidate license plate region
   * Supports 'adaptive' (Bradley local window for webcams with overexposure/dark grills)
   * and 'otsu' (high contrast global threshold for clean synthetic/standalone plates)
   */
  preprocessPlateImage(
    sourceCanvas: HTMLCanvasElement,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
    mode: 'adaptive' | 'otsu' = 'adaptive'
  ): HTMLCanvasElement {
    const scale = Math.max(1.8, Math.min(3.5, 320 / Math.max(1, cropW)));
    const targetW = Math.max(220, Math.round(cropW * scale));
    const targetH = Math.max(55, Math.round(cropH * scale));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return tempCanvas;

    tCtx.imageSmoothingEnabled = true;
    tCtx.imageSmoothingQuality = 'high';
    tCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    const imgData = tCtx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;
    const total = targetW * targetH;
    const gray = new Uint8ClampedArray(total);

    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    const margin = 16;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetW + margin * 2;
    outCanvas.height = targetH + margin * 2;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return tempCanvas;

    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    const outImg = outCtx.getImageData(margin, margin, targetW, targetH);
    const outData = outImg.data;

    if (mode === 'adaptive') {
      // 1. Integral Image Calculation
      const intImg = new Float64Array((targetW + 1) * (targetH + 1));
      for (let y = 0; y < targetH; y++) {
        let sum = 0;
        for (let x = 0; x < targetW; x++) {
          sum += gray[y * targetW + x];
          intImg[(y + 1) * (targetW + 1) + (x + 1)] = intImg[y * (targetW + 1) + (x + 1)] + sum;
        }
      }

      const S = Math.round(targetW / 18);
      const T = 0.12;

      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const x1 = Math.max(0, x - Math.floor(S / 2));
          const x2 = Math.min(targetW, x + Math.floor(S / 2));
          const y1 = Math.max(0, y - Math.floor(S / 2));
          const y2 = Math.min(targetH, y + Math.floor(S / 2));
          const count = (x2 - x1) * (y2 - y1);
          const sum =
            intImg[y2 * (targetW + 1) + x2] -
            intImg[y1 * (targetW + 1) + x2] -
            intImg[y2 * (targetW + 1) + x1] +
            intImg[y1 * (targetW + 1) + x1];
          const mean = sum / count;

          const isDark = gray[y * targetW + x] < mean * (1 - T);
          const val = isDark ? 0 : 255;
          const idx = (y * targetW + x) * 4;
          outData[idx] = val;
          outData[idx + 1] = val;
          outData[idx + 2] = val;
          outData[idx + 3] = 255;
        }
      }

      outCtx.putImageData(outImg, margin, margin);
      return outCanvas;
    }

    // Mode: 'otsu'
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < total; i++) {
      if (gray[i] < minLum) minLum = gray[i];
      if (gray[i] > maxLum) maxLum = gray[i];
    }
    const range = Math.max(1, maxLum - minLum);

    const hist = new Uint32Array(256);
    let sum = 0;
    for (let i = 0; i < total; i++) {
      const val = Math.round(((gray[i] - minLum) / range) * 255);
      gray[i] = val;
      hist[val]++;
      sum += val;
    }

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

    for (let i = 0; i < data.length; i += 4) {
      const isChar = gray[i / 4] < threshold;
      const finalVal = isChar ? 0 : 255;
      outData[i] = finalVal;
      outData[i + 1] = finalVal;
      outData[i + 2] = finalVal;
      outData[i + 3] = 255;
    }

    outCtx.putImageData(outImg, margin, margin);
    return outCanvas;
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

      // Handle standalone HTMLCanvasElement directly
      if (source instanceof HTMLCanvasElement) {
        const cropX = bbox ? Math.max(0, bbox[0]) : 0;
        const cropY = bbox ? Math.max(0, bbox[1]) : 0;
        const cropW = bbox ? Math.min(width - cropX, bbox[2]) : width;
        const cropH = bbox ? Math.min(height - cropY, bbox[3]) : height;

        const plateCrop = this.findPlateSubcrop(srcCanvas, cropX, cropY, cropW, cropH);

        // Pass 1: Adaptive binarization
        const canvasAdapt = this.preprocessPlateImage(srcCanvas, plateCrop.x, plateCrop.y, plateCrop.w, plateCrop.h, 'adaptive');
        const resAdapt = await this.worker.recognize(canvasAdapt);
        const rawAdapt = resAdapt.data.text ? resAdapt.data.text.trim() : '';
        const normAdapt = rawAdapt ? normalizePlateText(rawAdapt) : null;
        if (normAdapt) {
          return {
            ...normAdapt,
            rawText: rawAdapt,
            processedImageCrop: canvasAdapt.toDataURL('image/jpeg', 0.85)
          };
        }

        // Pass 2: Otsu binarization
        const canvasOtsu = this.preprocessPlateImage(srcCanvas, plateCrop.x, plateCrop.y, plateCrop.w, plateCrop.h, 'otsu');
        const resOtsu = await this.worker.recognize(canvasOtsu);
        const rawOtsu = resOtsu.data.text ? resOtsu.data.text.trim() : '';
        const normOtsu = rawOtsu ? normalizePlateText(rawOtsu) : null;
        if (normOtsu) {
          return {
            ...normOtsu,
            rawText: rawOtsu,
            processedImageCrop: canvasOtsu.toDataURL('image/jpeg', 0.85)
          };
        }

        // Pass 3: Direct scaled crop
        const scale = 2.0;
        const directCanvas = document.createElement('canvas');
        directCanvas.width = Math.round(plateCrop.w * scale);
        directCanvas.height = Math.round(plateCrop.h * scale);
        const dCtx = directCanvas.getContext('2d');
        if (dCtx) {
          dCtx.imageSmoothingEnabled = true;
          dCtx.imageSmoothingQuality = 'high';
          dCtx.drawImage(srcCanvas, plateCrop.x, plateCrop.y, plateCrop.w, plateCrop.h, 0, 0, directCanvas.width, directCanvas.height);
          const resDirect = await this.worker.recognize(directCanvas);
          const rawDirect = resDirect.data.text ? resDirect.data.text.trim() : '';
          const normDirect = rawDirect ? normalizePlateText(rawDirect) : null;
          if (normDirect) {
            return {
              ...normDirect,
              rawText: rawDirect,
              processedImageCrop: directCanvas.toDataURL('image/jpeg', 0.85)
            };
          }
        }

        // Pass 4: Fallback to full optical reticle bounding box (crucial for papers and large plates)
        if (plateCrop.w !== cropW || plateCrop.h !== cropH) {
          const reticleAdapt = this.preprocessPlateImage(srcCanvas, cropX, cropY, cropW, cropH, 'adaptive');
          const resReticle = await this.worker.recognize(reticleAdapt);
          const rawReticle = resReticle.data.text ? resReticle.data.text.trim() : '';
          const normReticle = rawReticle ? normalizePlateText(rawReticle) : null;
          if (normReticle) {
            return {
              ...normReticle,
              rawText: rawReticle,
              processedImageCrop: reticleAdapt.toDataURL('image/jpeg', 0.85)
            };
          }
        }

        return null;
      }

      // Handling HTMLVideoElement
      // Candidate 1: Optical Central Reticle (Viseur LAPI [15%..85% width, 25%..75% height])
      const reticleX = Math.round(width * 0.15);
      const reticleY = Math.round(height * 0.25);
      const reticleW = Math.round(width * 0.70);
      const reticleH = Math.round(height * 0.50);

      const plateCrop1 = this.findPlateSubcrop(srcCanvas, reticleX, reticleY, reticleW, reticleH);

      // Try Bradley Adaptive on Candidate 1
      const adaptCanvas1 = this.preprocessPlateImage(srcCanvas, plateCrop1.x, plateCrop1.y, plateCrop1.w, plateCrop1.h, 'adaptive');
      let result = await this.worker.recognize(adaptCanvas1);
      let rawText = result.data.text ? result.data.text.trim() : '';
      let normalized = rawText ? normalizePlateText(rawText) : null;
      let activeCanvas = adaptCanvas1;

      // Try Otsu on Candidate 1 if adaptive didn't produce a normalized plate
      if (!normalized) {
        const otsuCanvas1 = this.preprocessPlateImage(srcCanvas, plateCrop1.x, plateCrop1.y, plateCrop1.w, plateCrop1.h, 'otsu');
        const resOtsu1 = await this.worker.recognize(otsuCanvas1);
        const rawOtsu1 = resOtsu1.data.text ? resOtsu1.data.text.trim() : '';
        const normOtsu1 = rawOtsu1 ? normalizePlateText(rawOtsu1) : null;
        if (normOtsu1) {
          result = resOtsu1;
          rawText = rawOtsu1;
          normalized = normOtsu1;
          activeCanvas = otsuCanvas1;
        }
      }

      // Candidate 2: Detected Vehicle Bounding Box
      if (!normalized && bbox) {
        const [vx, vy, vw, vh] = bbox;
        const boxX = Math.max(0, Math.round(vx + vw * 0.05));
        const boxY = Math.max(0, Math.round(vy + vh * 0.20));
        const boxW = Math.min(width - boxX, Math.round(vw * 0.90));
        const boxH = Math.min(height - boxY, Math.round(vh * 0.70));

        const plateCrop2 = this.findPlateSubcrop(srcCanvas, boxX, boxY, boxW, boxH);
        const adaptCanvas2 = this.preprocessPlateImage(srcCanvas, plateCrop2.x, plateCrop2.y, plateCrop2.w, plateCrop2.h, 'adaptive');
        const res2 = await this.worker.recognize(adaptCanvas2);
        const raw2 = res2.data.text ? res2.data.text.trim() : '';
        const norm2 = raw2 ? normalizePlateText(raw2) : null;

        if (norm2) {
          result = res2;
          rawText = raw2;
          normalized = norm2;
          activeCanvas = adaptCanvas2;
        } else {
          const otsuCanvas2 = this.preprocessPlateImage(srcCanvas, plateCrop2.x, plateCrop2.y, plateCrop2.w, plateCrop2.h, 'otsu');
          const resOtsu2 = await this.worker.recognize(otsuCanvas2);
          const rawOtsu2 = resOtsu2.data.text ? resOtsu2.data.text.trim() : '';
          const normOtsu2 = rawOtsu2 ? normalizePlateText(rawOtsu2) : null;
          if (normOtsu2) {
            result = resOtsu2;
            rawText = rawOtsu2;
            normalized = normOtsu2;
            activeCanvas = otsuCanvas2;
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
 * Normalizes and grammatically corrects OCR text to Guinea-Bissau (GB), Senegal (DK) or International transit formats
 * Resolves standard OCR glyph confusions (e.g. 8 <-> B, 0 <-> O, 1 <-> I, 4 <-> A, 5 <-> S, 6 <-> G, 7 <-> T)
 */
function correctDigits(str: string): string {
  return str
    .replace(/O|D/g, '0')
    .replace(/I|L/g, '1')
    .replace(/Z/g, '2')
    .replace(/E/g, '3')
    .replace(/A/g, '4')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/T/g, '7')
    .replace(/B/g, '8');
}

function correctLetters(str: string): string {
  return str
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/2/g, 'Z')
    .replace(/3/g, 'E')
    .replace(/4/g, 'A')
    .replace(/5/g, 'S')
    .replace(/6/g, 'G')
    .replace(/7/g, 'T')
    .replace(/8/g, 'B');
}

/**
 * Normalizes and grammatically corrects OCR text to Guinea-Bissau (GB), Senegal (DK) or International transit formats
 * Resolves standard OCR glyph confusions
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
  if (clean.length < 5) return null;

  // Reject on-screen display timestamp / camera text (e.g. "04-24-2020", "FRI", "CAMERA 01")
  if (/CAMERA|FRI|MON|TUE|WED|THU|SAT|SUN/.test(clean)) return null;

  // 1. Guinea-Bissau Match: GB + 3-4 digits + 1-2 letters (e.g. GB-2345-AF, GB-123-AF)
  let gbCandidate = clean;
  if (/^(GB|G8|6B|68|CB|QB)/.test(gbCandidate)) {
    gbCandidate = 'GB' + gbCandidate.substring(2);
  }

  const gbPattern = /^GB([0-9OIZSBLAEGT]{3,4})([A-Z0-9]{1,2})$/;
  const gbMatch = gbCandidate.match(gbPattern);
  if (gbMatch) {
    const rawDigits = gbMatch[1];
    const rawLetters = gbMatch[2];

    // Suffix must NOT contain digits that cannot be letters (i.e., reject 3, 4, 6, 7, 9)
    // and if suffix was a pure digit like '4', reject it
    if (!/[34679]/.test(rawLetters) && !/^\d+$/.test(rawLetters)) {
      return {
        plateNumber: `GB-${correctDigits(rawDigits)}-${correctLetters(rawLetters)}`,
        confidence: 96,
        country: 'GW',
        countryLabel: '🇬🇼 Guinée-Bissau'
      };
    }
  }

  // 2. Senegal Cross-Border Match: DK (Dakar), ZG (Ziguinchor Casamance), KD (Kolda), TH, KL, SL
  let snPrefix: string | null = null;
  let snRemainder = clean;

  if (/^(DK|0K|OK)/i.test(snRemainder)) {
    snPrefix = 'DK';
    snRemainder = snRemainder.substring(2);
  } else if (/^(ZG|2G|7G)/i.test(snRemainder)) {
    snPrefix = 'ZG'; // Ziguinchor Casamance border
    snRemainder = snRemainder.substring(2);
  } else if (/^(KD|KO|K0)/i.test(snRemainder)) {
    snPrefix = 'KD'; // Kolda border
    snRemainder = snRemainder.substring(2);
  } else if (/^(TH|KL|SL)/i.test(snRemainder)) {
    snPrefix = snRemainder.substring(0, 2).toUpperCase();
    snRemainder = snRemainder.substring(2);
  }

  if (snPrefix) {
    const snPattern = /^([0-9OIZSBLAEGT]{3,4})([A-Z0-9]{1,2})$/;
    const snMatch = snRemainder.match(snPattern);
    if (snMatch) {
      const rawDigits = snMatch[1];
      const rawLetters = snMatch[2];

      if (!/[34679]/.test(rawLetters) && !/^\d+$/.test(rawLetters)) {
        return {
          plateNumber: `${snPrefix}-${correctDigits(rawDigits)}-${correctLetters(rawLetters)}`,
          confidence: 95,
          country: 'SN',
          countryLabel: '🇸🇳 Sénégal'
        };
      }
    }
  }

  // 3. International / European import format: 2 letters - 3 digits - 2 letters (e.g. AA-331-CM, AB-093-FB)
  // Tolerates single euro-band letter prefix (F, L, D...) and trailing region digits (75, 13...)
  const intlRegex = /^(?:[A-Z]{1})?([A-Z0-9]{2})([0-9OIZSBLAEGT]{3})([A-Z0-9]{2})(?:[0-9]{2})?$/;
  const intlMatch = clean.match(intlRegex);
  if (intlMatch) {
    const rawPrefix = intlMatch[1];
    const rawDigits = intlMatch[2];
    const rawSuffix = intlMatch[3];

    // Suffix and prefix must not be pure digits or contain 3, 4, 6, 7, 9
    if (!/[34679]/.test(rawPrefix) && !/[34679]/.test(rawSuffix) && !/^\d+$/.test(rawPrefix) && !/^\d+$/.test(rawSuffix)) {
      return {
        plateNumber: `${correctLetters(rawPrefix)}-${correctDigits(rawDigits)}-${correctLetters(rawSuffix)}`,
        confidence: 96,
        country: 'UNKNOWN',
        countryLabel: '🌐 Transit / Import'
      };
    }
  }

  // 4. Unprefixed Guinea-Bissau: strictly 4 digits + 2 letters (e.g. 4512 AZ -> GB-4512-AZ)
  // Rejects 3-digit noise (e.g. 471NN)
  const genMatch = clean.match(/^([0-9OIZSBLAEGT]{4})([A-Z0-9]{2})$/);
  if (genMatch) {
    const rawDigits = genMatch[1];
    const rawLetters = genMatch[2];
    if (!/[34679]/.test(rawLetters) && !/^\d+$/.test(rawLetters)) {
      return {
        plateNumber: `GB-${correctDigits(rawDigits)}-${correctLetters(rawLetters)}`,
        confidence: 90,
        country: 'GW',
        countryLabel: '🇬🇼 Guinée-Bissau'
      };
    }
  }

  return null;
}

export const anprOcrService = new AnprOcrService();
