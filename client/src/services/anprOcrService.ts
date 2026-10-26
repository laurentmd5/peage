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
          tessedit_pageseg_mode: '6' as any // Single uniform block of text (prevents vertical squashing on tall crops)
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
   * 2D Integral-Image White-Plate + Black-Character Island Detector
   * Locates the compact license plate rectangle (e.g. AA-112-AA) anywhere inside (rx, ry, rw, rh)
   * Ignores dark grilles/rings (low white ratio) and blank white walls (zero character edges)
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
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { x: rx, y: ry, w: rw, h: rh };
      ctx.drawImage(sourceCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
      const data = ctx.getImageData(0, 0, rw, rh).data;

      // Build 2D Integral Images for:
      // 1) Neutral bright plate pixels (intWhite)
      // 2) Sharp dark-character-to-white-plate horizontal transitions (intEdge)
      const stride = rw + 1;
      const intWhite = new Int32Array((rh + 1) * stride);
      const intEdge = new Int32Array((rh + 1) * stride);
      const lumRow = new Uint8Array(rw);

      for (let y = 0; y < rh; y++) {
        let rowW = 0;
        let rowE = 0;
        const yOff = (y + 1) * stride;
        const prevYOff = y * stride;

        for (let x = 0; x < rw; x++) {
          const idx = (y * rw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = (r * 77 + g * 150 + b * 29) >> 8;
          lumRow[x] = lum;

          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const isWhitePlateBg = lum > 125 && (maxC - minC) < 50 ? 1 : 0;

          let isCharStrokeEdge = 0;
          if (x >= 2) {
            const prevL = lumRow[x - 2];
            const diff = Math.abs(lum - prevL);
            const minL = Math.min(lum, prevL);
            const maxL = Math.max(lum, prevL);
            // Direct horizontal transition between dark character stroke (< 108) and bright plate (> 120)
            if (diff > 34 && minL < 108 && maxL > 120) {
              isCharStrokeEdge = 1;
            }
          }

          rowW += isWhitePlateBg;
          rowE += isCharStrokeEdge;
          intWhite[yOff + x + 1] = intWhite[prevYOff + x + 1] + rowW;
          intEdge[yOff + x + 1] = intEdge[prevYOff + x + 1] + rowE;
        }
      }

      const rectSum = (integral: Int32Array, x1: number, y1: number, x2: number, y2: number): number => {
        return (
          integral[y2 * stride + x2] -
          integral[y1 * stride + x2] -
          integral[y2 * stride + x1] +
          integral[y1 * stride + x1]
        );
      };

      // Multi-scale 2D sliding window search for the white-plate + black-characters island
      const xMinSearch = Math.round(rw * 0.14);
      const xMaxSearch = Math.round(rw * 0.88);
      const yMinSearch = Math.round(rh * 0.06);
      const yMaxSearch = Math.round(rh * 0.94);

      const widthFractions = [0.18, 0.25, 0.35, 0.48];
      const aspectRatios = [2.6, 3.4];

      let bestScore = 0;
      let bestBox: { x: number; y: number; w: number; h: number } | null = null;

      for (const wf of widthFractions) {
        const ww = Math.max(64, Math.round(rw * wf));
        for (const ar of aspectRatios) {
          const wh = Math.max(22, Math.round(ww / ar));
          if (wh > rh * 0.45) continue;

          const stepX = Math.max(6, Math.round(ww * 0.12));
          const stepY = Math.max(4, Math.round(wh * 0.15));
          const area = ww * wh;

          for (let wy = yMinSearch; wy + wh <= yMaxSearch; wy += stepY) {
            for (let wx = xMinSearch; wx + ww <= xMaxSearch; wx += stepX) {
              const whiteCount = rectSum(intWhite, wx, wy, wx + ww, wy + wh);
              const whiteRatio = whiteCount / area;
              // Must have substantial white plate background (26%..86%), rejecting dark grilles (<26%) and blank walls (>86%)
              if (whiteRatio < 0.26 || whiteRatio > 0.86) continue;

              const edgeCount = rectSum(intEdge, wx, wy, wx + ww, wy + wh);
              const edgeRatio = edgeCount / area;
              if (edgeRatio < 0.032) continue;

              // Normalize density score so compact tight windows around AA-112-AA beat oversized windows
              const score = (edgeRatio * 100) * Math.min(1.0, whiteRatio * 1.8) * Math.pow(area, 0.15);
              if (score > bestScore) {
                bestScore = score;
                bestBox = { x: wx, y: wy, w: ww, h: wh };
              }
            }
          }
        }
      }

      if (bestBox) {
        const padX = Math.round(bestBox.w * 0.12);
        const padY = Math.round(bestBox.h * 0.25);
        const px = Math.max(0, bestBox.x - padX);
        const py = Math.max(0, bestBox.y - padY);
        const pw = Math.min(rw - px, bestBox.w + padX * 2);
        const ph = Math.min(rh - py, bestBox.h + padY * 2);
        return { x: rx + px, y: ry + py, w: pw, h: ph };
      }
    } catch {
      // Fallback on error
    }

    if (rh > 80 && rw > 120) {
      return {
        x: rx + Math.round(rw * 0.20),
        y: ry + Math.round(rh * 0.25),
        w: Math.round(rw * 0.60),
        h: Math.round(rh * 0.50)
      };
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
    mode: 'adaptive' | 'otsu' = 'adaptive',
    tiltDeg = 0
  ): HTMLCanvasElement {
    const scale = Math.max(1.8, Math.min(3.5, 320 / Math.max(1, cropW)));
    const targetW = Math.max(220, Math.round(cropW * scale));
    const targetH = Math.max(55, Math.round(cropH * scale));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tCtx) return tempCanvas;

    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, targetW, targetH);
    tCtx.imageSmoothingEnabled = true;
    tCtx.imageSmoothingQuality = 'high';
    if (tiltDeg !== 0) {
      tCtx.save();
      tCtx.translate(targetW / 2, targetH / 2);
      tCtx.rotate((tiltDeg * Math.PI) / 180);
      tCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, -targetW / 2, -targetH / 2, targetW, targetH);
      tCtx.restore();
    } else {
      tCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
    }

    const imgData = tCtx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;
    const total = targetW * targetH;
    const gray = new Uint8ClampedArray(total);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Suppress European blue euro-bands ([F] on left, [75] on right) so they become clean white margin
      // instead of a black vertical block merging with the first or last character
      if (b > r + 18 && b > g + 8 && r < 120) {
        gray[i / 4] = 255;
      } else {
        gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
    }

    const margin = 16;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetW + margin * 2;
    outCanvas.height = targetH + margin * 2;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
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

      // Suppress dark vertical side-borders (Euroband or dark car grille on left/right 14% of plate crop)
      const sideEdgeW = Math.round(targetW * 0.14);
      for (let x = 0; x < targetW; x++) {
        if (x < sideEdgeW || x > targetW - sideEdgeW) {
          let darkCount = 0;
          for (let y = 0; y < targetH; y++) {
            if (outData[(y * targetW + x) * 4] === 0) darkCount++;
          }
          if (darkCount > targetH * 0.55) {
            for (let y = 0; y < targetH; y++) {
              const idx = (y * targetW + x) * 4;
              outData[idx] = 255;
              outData[idx + 1] = 255;
              outData[idx + 2] = 255;
            }
          }
        }
      }

      outCtx.putImageData(outImg, margin, margin);

      // Despeckle / Despike filter: remove thin 1px/2px vertical/horizontal noise lines
      const cleanedImg = outCtx.getImageData(0, 0, outCanvas.width, outCanvas.height);
      const cData = cleanedImg.data;
      const cW = outCanvas.width;
      const cH = outCanvas.height;

      for (let y = margin; y < cH - margin; y++) {
        for (let x = margin; x < cW - margin; x++) {
          const idx = (y * cW + x) * 4;
          if (cData[idx] === 0) {
            const leftIsWhite = cData[idx - 4] === 255;
            const rightIsWhite = cData[idx + 4] === 255;
            const topIsWhite = cData[idx - cW * 4] === 255;
            const bottomIsWhite = cData[idx + cW * 4] === 255;

            if ((leftIsWhite && rightIsWhite) || (topIsWhite && bottomIsWhite)) {
              cData[idx] = 255;
              cData[idx + 1] = 255;
              cData[idx + 2] = 255;
            } else if (leftIsWhite && x < cW - margin - 1 && cData[idx + 4] === 0 && cData[idx + 8] === 255) {
              cData[idx] = 255;
              cData[idx + 1] = 255;
              cData[idx + 2] = 255;
              cData[idx + 4] = 255;
              cData[idx + 5] = 255;
              cData[idx + 6] = 255;
              x++;
            } else if (topIsWhite && y < cH - margin - 1 && cData[idx + cW * 4] === 0 && cData[idx + cW * 8] === 255) {
              cData[idx] = 255;
              cData[idx + 1] = 255;
              cData[idx + 2] = 255;
              cData[idx + cW * 4] = 255;
              cData[idx + cW * 4 + 1] = 255;
              cData[idx + cW * 4 + 2] = 255;
            }
          }
        }
      }
      outCtx.putImageData(cleanedImg, 0, 0);

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

    // Suppress dark vertical side-borders in Otsu mode as well
    const sideEdgeWOtsu = Math.round(targetW * 0.14);
    for (let x = 0; x < targetW; x++) {
      if (x < sideEdgeWOtsu || x > targetW - sideEdgeWOtsu) {
        let darkCount = 0;
        for (let y = 0; y < targetH; y++) {
          if (outData[(y * targetW + x) * 4] === 0) darkCount++;
        }
        if (darkCount > targetH * 0.55) {
          for (let y = 0; y < targetH; y++) {
            const idx = (y * targetW + x) * 4;
            outData[idx] = 255;
            outData[idx + 1] = 255;
            outData[idx + 2] = 255;
          }
        }
      }
    }

    outCtx.putImageData(outImg, margin, margin);

    const cleanedImgOtsu = outCtx.getImageData(0, 0, outCanvas.width, outCanvas.height);
    const coData = cleanedImgOtsu.data;
    const coW = outCanvas.width;
    const coH = outCanvas.height;

    for (let y = margin; y < coH - margin; y++) {
      for (let x = margin; x < coW - margin; x++) {
        const idx = (y * coW + x) * 4;
        if (coData[idx] === 0) {
          const leftIsWhite = coData[idx - 4] === 255;
          const rightIsWhite = coData[idx + 4] === 255;
          const topIsWhite = coData[idx - coW * 4] === 255;
          const bottomIsWhite = coData[idx + coW * 4] === 255;

          if ((leftIsWhite && rightIsWhite) || (topIsWhite && bottomIsWhite)) {
            coData[idx] = 255;
            coData[idx + 1] = 255;
            coData[idx + 2] = 255;
          } else if (leftIsWhite && x < coW - margin - 1 && coData[idx + 4] === 0 && coData[idx + 8] === 255) {
            coData[idx] = 255;
            coData[idx + 1] = 255;
            coData[idx + 2] = 255;
            coData[idx + 4] = 255;
            coData[idx + 5] = 255;
            coData[idx + 6] = 255;
            x++;
          } else if (topIsWhite && y < coH - margin - 1 && coData[idx + coW * 4] === 0 && coData[idx + coW * 8] === 255) {
            coData[idx] = 255;
            coData[idx + 1] = 255;
            coData[idx + 2] = 255;
            coData[idx + coW * 4] = 255;
            coData[idx + coW * 4 + 1] = 255;
            coData[idx + coW * 4 + 2] = 255;
          }
        }
      }
    }
    outCtx.putImageData(cleanedImgOtsu, 0, 0);

    return outCanvas;
  }

  /**
   * Rotate a canvas by 90, 180, or 270 degrees, or deskew by small perspective tilt angles (e.g. +9° / -9°)
   */
  rotateCanvas(src: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
    const dest = document.createElement('canvas');
    const rad = (degrees * Math.PI) / 180;
    if (degrees === 90 || degrees === 270) {
      dest.width = src.height;
      dest.height = src.width;
    } else {
      dest.width = src.width;
      dest.height = src.height;
    }
    const ctx = dest.getContext('2d', { willReadFrequently: true });
    if (!ctx) return src;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dest.width, dest.height);
    ctx.translate(dest.width / 2, dest.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return dest;
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

      const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (!sCtx) return null;
      sCtx.drawImage(source, 0, 0);

      // Handle standalone HTMLCanvasElement directly
      if (source instanceof HTMLCanvasElement) {
        // Always exclude top 14% (Hikvision OSD timestamp e.g. "10-26-2026 Mon") and bottom 12% (OSD camera name) on full camera frames
        const minSafeY = height >= 240 ? Math.round(height * 0.14) : 0;
        const maxSafeY = height >= 240 ? Math.round(height * 0.88) : height;
        const cropX = bbox ? Math.max(0, bbox[0]) : Math.round(width * 0.06);
        const cropY = bbox ? Math.max(minSafeY, bbox[1]) : minSafeY;
        const cropW = bbox ? Math.min(width - cropX, bbox[2]) : Math.round(width * 0.88);
        const cropH = bbox ? Math.min(maxSafeY - cropY, bbox[3]) : (maxSafeY - cropY);

        const plateCrop = this.findPlateSubcrop(srcCanvas, cropX, cropY, cropW, cropH);

        // Pass 1: Adaptive binarization on targeted plate subcrop (0° horizontal)
        const canvasAdapt = this.preprocessPlateImage(srcCanvas, plateCrop.x, plateCrop.y, plateCrop.w, plateCrop.h, 'adaptive', 0);
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

        // Pass 2: Pre-binarization Perspective Deskew (+11°, +15°, -11°) for 3/4 angled toll lane cameras (like tilted AA-112-AA)
        for (const tiltAngle of [11, 15, -11] as const) {
          const deskewed = this.preprocessPlateImage(srcCanvas, plateCrop.x, plateCrop.y, plateCrop.w, plateCrop.h, 'adaptive', tiltAngle);
          const resDeskew = await this.worker.recognize(deskewed);
          const rawDeskew = resDeskew.data.text ? resDeskew.data.text.trim() : '';
          const normDeskew = rawDeskew ? normalizePlateText(rawDeskew) : null;
          if (normDeskew) {
            return {
              ...normDeskew,
              rawText: rawDeskew,
              processedImageCrop: deskewed.toDataURL('image/jpeg', 0.85)
            };
          }
        }

        // Pass 3: Otsu binarization on targeted plate subcrop (0° and +11°)
        for (const tiltAngle of [0, 11] as const) {
          const canvasOtsu = this.preprocessPlateImage(srcCanvas, plateCrop.x, plateCrop.y, plateCrop.w, plateCrop.h, 'otsu', tiltAngle);
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
        }

        // Pass 4: Multi-zone fallback (Upper-Mid Bumper & Lower-Mid Bumper) if plateCrop missed
        const zones = [
          { x: cropX + Math.round(cropW * 0.20), y: cropY + Math.round(cropH * 0.45), w: Math.round(cropW * 0.55), h: Math.round(cropH * 0.45) },
          { x: cropX + Math.round(cropW * 0.22), y: cropY + Math.round(cropH * 0.10), w: Math.round(cropW * 0.55), h: Math.round(cropH * 0.42) }
        ];
        for (const z of zones) {
          const zSub = this.findPlateSubcrop(srcCanvas, z.x, z.y, z.w, z.h);
          const zAdapt = this.preprocessPlateImage(srcCanvas, zSub.x, zSub.y, zSub.w, zSub.h, 'adaptive', 11);
          const resZ = await this.worker.recognize(zAdapt);
          const rawZ = resZ.data.text ? resZ.data.text.trim() : '';
          const normZ = rawZ ? normalizePlateText(rawZ) : null;
          if (normZ) {
            return {
              ...normZ,
              rawText: rawZ,
              processedImageCrop: zAdapt.toDataURL('image/jpeg', 0.85)
            };
          }
        }

        // Pass 5: Multi-Orientation Auto-Rotation (90° and 270°)
        for (const angle of [90, 270] as const) {
          const rotCanvas = this.rotateCanvas(canvasAdapt, angle);
          const resRot = await this.worker.recognize(rotCanvas);
          const rawRot = resRot.data.text ? resRot.data.text.trim() : '';
          const normRot = rawRot ? normalizePlateText(rawRot) : null;
          if (normRot) {
            console.log(`[ANPR OCR] 🔄 Plaque détectée avec rotation automatique ${angle}°:`, normRot.plateNumber);
            return {
              ...normRot,
              rawText: rawRot,
              processedImageCrop: rotCanvas.toDataURL('image/jpeg', 0.85)
            };
          }
        }

        return null;
      }

      // Handling HTMLVideoElement (Webcam Live Stream)
      // Candidate 1: Optical Central Reticle (Viseur LAPI [15%..85% width, 25%..75% height])
      const reticleX = Math.round(width * 0.15);
      const reticleY = Math.round(height * 0.25);
      const reticleW = Math.round(width * 0.70);
      const reticleH = Math.round(height * 0.50);

      const plateCrop1 = this.findPlateSubcrop(srcCanvas, reticleX, reticleY, reticleW, reticleH);

      // Try Bradley Adaptive on Candidate 1
      const adaptCanvas1 = this.preprocessPlateImage(srcCanvas, plateCrop1.x, plateCrop1.y, plateCrop1.w, plateCrop1.h, 'adaptive', 0);
      let result = await this.worker.recognize(adaptCanvas1);
      let rawText = result.data.text ? result.data.text.trim() : '';
      let normalized = rawText ? normalizePlateText(rawText) : null;
      let activeCanvas = adaptCanvas1;

      // Try Pre-binarization Deskew (+11° / -11°) on Candidate 1
      if (!normalized) {
        for (const tiltAngle of [11, -11] as const) {
          const deskewCanvas1 = this.preprocessPlateImage(srcCanvas, plateCrop1.x, plateCrop1.y, plateCrop1.w, plateCrop1.h, 'adaptive', tiltAngle);
          const resDeskew1 = await this.worker.recognize(deskewCanvas1);
          const rawDeskew1 = resDeskew1.data.text ? resDeskew1.data.text.trim() : '';
          const normDeskew1 = rawDeskew1 ? normalizePlateText(rawDeskew1) : null;
          if (normDeskew1) {
            result = resDeskew1;
            rawText = rawDeskew1;
            normalized = normDeskew1;
            activeCanvas = deskewCanvas1;
            break;
          }
        }
      }

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

      // Fallback on full optical reticle if subcrop missed a large hand-held plate/paper
      if (!normalized && (plateCrop1.w !== reticleW || plateCrop1.h !== reticleH)) {
        const fullReticleCanvas = this.preprocessPlateImage(srcCanvas, reticleX, reticleY, reticleW, reticleH, 'adaptive');
        const resFull = await this.worker.recognize(fullReticleCanvas);
        const rawFull = resFull.data.text ? resFull.data.text.trim() : '';
        const normFull = rawFull ? normalizePlateText(rawFull) : null;
        if (normFull) {
          result = resFull;
          rawText = rawFull;
          normalized = normFull;
          activeCanvas = fullReticleCanvas;
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
        }
      }

      // Candidate 3: Multi-orientation rotation on reticle
      if (!normalized) {
        for (const angle of [90, 270] as const) {
          const rotCanvas = this.rotateCanvas(adaptCanvas1, angle);
          const resRot = await this.worker.recognize(rotCanvas);
          const rawRot = resRot.data.text ? resRot.data.text.trim() : '';
          const normRot = rawRot ? normalizePlateText(rawRot) : null;
          if (normRot) {
            console.log(`[ANPR OCR Video] 🔄 Plaque détectée avec rotation ${angle}°:`, normRot.plateNumber);
            result = resRot;
            rawText = rawRot;
            normalized = normRot;
            activeCanvas = rotCanvas;
            break;
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
 * Resolves strict optical glyph confusions (0 <-> O/D, 1 <-> I/L, 2 <-> Z, 5 <-> S, 8 <-> B)
 * NEVER converts French vowels/consonants (A, E, T, G) into digits to avoid hallucinating words into plates.
 */
function correctDigits(str: string): string {
  return str
    .replace(/O|D|Q/g, '0')
    .replace(/I|L/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

function correctLetters(str: string): string {
  return str
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/2/g, 'Z')
    .replace(/4/g, 'A')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B');
}

function countActualDigits(str: string): number {
  return (str.match(/[0-9]/g) || []).length;
}

/**
 * Helper to match and normalize a single alphanumeric candidate string against known plate templates
 */
function parseSinglePlateCandidate(clean: string): {
  plateNumber: string;
  confidence: number;
  country: 'GW' | 'SN' | 'UNKNOWN';
  countryLabel: string;
} | null {
  if (!clean || clean.length < 5) return null;

  // Reject on-screen display timestamp / camera text / background wall text
  if (/CAMERA|FRI|MON|TUE|WED|THU|SAT|SUN|SYSTEM|SECURIT|VIDEO|INFORM|CONTROL/.test(clean)) return null;

  // 1. Guinea-Bissau Match: GB + 3-4 digits + 1-2 letters (e.g. GB-2345-AF, GB-123-AF)
  let gbCandidate = clean;
  if (/^(GB|G8|6B|68|CB|QB)/.test(gbCandidate)) {
    gbCandidate = 'GB' + gbCandidate.substring(2);
  }

  const gbPattern = /^GB([0-9OIZSBL]{3,4})([A-Z0-9]{1,2})$/;
  const gbMatch = gbCandidate.match(gbPattern);
  if (gbMatch) {
    const rawDigits = gbMatch[1];
    const rawLetters = gbMatch[2];

    if (countActualDigits(rawDigits) >= 2 && !/[34679]/.test(rawLetters) && !/^\d+$/.test(rawLetters)) {
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
    snPrefix = 'ZG';
    snRemainder = snRemainder.substring(2);
  } else if (/^(KD|KO|K0)/i.test(snRemainder)) {
    snPrefix = 'KD';
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

      if (countActualDigits(rawDigits) >= 2 && !/[34679]/.test(rawLetters) && !/^\d+$/.test(rawLetters)) {
        return {
          plateNumber: `${snPrefix}-${correctDigits(rawDigits)}-${correctLetters(rawLetters)}`,
          confidence: 95,
          country: 'SN',
          countryLabel: '🇸🇳 Sénégal'
        };
      }
    }
  }

  // 3. International / European SIV import format: 2 letters - 3 digits - 2 letters (e.g. AA-112-AA, AB-093-FB)
  // Tolerates single euro-band letter prefix (F, L, D...) and trailing region digits (75, 13...)
  const intlRegex = /^(?:[A-Z]{1})?([A-Z0-9]{2})([0-9OIZSBL]{3})([A-Z0-9]{2})(?:[0-9]{2})?$/;
  const intlMatch = clean.match(intlRegex);
  if (intlMatch) {
    let rawPrefix = intlMatch[1];
    const rawDigits = intlMatch[2];
    const rawSuffix = intlMatch[3];

    if (
      countActualDigits(rawDigits) >= 2 &&
      !/[3679]/.test(rawPrefix) &&
      !/[3679]/.test(rawSuffix) &&
      !/^\d+$/.test(rawPrefix) &&
      !/^\d+$/.test(rawSuffix)
    ) {
      let cleanPref = correctLetters(rawPrefix);
      const cleanSuf = correctLetters(rawSuffix);
      // If left Euroband [F] corrupted the first character of a symmetric SIV plate (e.g. BA-112-AA, IA-112-AA, FA-112-AA -> AA-112-AA)
      if (/^[FBIS8I][A-Z]$/.test(cleanPref) && cleanPref[1] === cleanSuf[0] && cleanSuf[0] === cleanSuf[1]) {
        cleanPref = cleanPref[1] + cleanPref[1];
      }
      return {
        plateNumber: `${cleanPref}-${correctDigits(rawDigits)}-${cleanSuf}`,
        confidence: 96,
        country: 'UNKNOWN',
        countryLabel: '🌐 Transit / Import'
      };
    }
  }

  // 3b. SIV plate with left character clipped by Euroband (e.g. "A112AA", "I112AA", "B112AA", "1112AA", "8112AA" -> "AA-112-AA")
  const clippedSivMatch = clean.match(/^(?:[FBI18])?([A-Z])?([0-9]{3})([A-Z]{2})(?:[0-9]{2})?$/);
  if (clippedSivMatch) {
    const leadLetter = clippedSivMatch[1];
    const digits3 = clippedSivMatch[2];
    const suffix2 = clippedSivMatch[3];
    if (leadLetter && leadLetter === suffix2[0]) {
      return {
        plateNumber: `${leadLetter}${leadLetter}-${digits3}-${suffix2}`,
        confidence: 94,
        country: 'UNKNOWN',
        countryLabel: '🌐 Transit / Import'
      };
    } else if (!leadLetter && suffix2[0] === suffix2[1]) {
      return {
        plateNumber: `${suffix2}-${digits3}-${suffix2}`,
        confidence: 93,
        country: 'UNKNOWN',
        countryLabel: '🌐 Transit / Import'
      };
    }
  }

  // 4. Unprefixed Guinea-Bissau: strictly 4 REAL digits + 2 letters (e.g. 4512 AZ -> GB-4512-AZ)
  // Requires 4 real digits and rejects camera OSD timestamps/years (e.g. "2026 Mon" -> "2028 MC")
  const genMatch = clean.match(/^([0-9]{4})([A-Z]{2})$/);
  if (genMatch) {
    const rawDigits = genMatch[1];
    const rawLetters = genMatch[2];
    const isOsdYearOrDate = /^20[123]\d$/.test(rawDigits) || /^19\d\d$/.test(rawDigits) || /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(rawDigits);
    const isOsdDayCode = /^(MO|TU|WE|TH|FR|SA|SU|MC|AM|PM)$/.test(rawLetters);
    if (!isOsdYearOrDate && !isOsdDayCode) {
      return {
        plateNumber: `GB-${rawDigits}-${rawLetters}`,
        confidence: 90,
        country: 'GW',
        countryLabel: '🇬🇼 Guinée-Bissau'
      };
    }
  }

  return null;
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

  // 1. Line by line analysis first (prevents concatenating unrelated background wall lines together)
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const cleanLine = line.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lineMatch = parseSinglePlateCandidate(cleanLine);
    if (lineMatch) return lineMatch;

    // Word tokens sliding window inside the line (e.g. "F AA-112-AA 75" or "AA 112 AA")
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      for (let i = 0; i < words.length; i++) {
        if (i + 2 < words.length) {
          const combo3 = (words[i] + words[i + 1] + words[i + 2]).toUpperCase().replace(/[^A-Z0-9]/g, '');
          const m3 = parseSinglePlateCandidate(combo3);
          if (m3) return m3;
        }
        if (i + 1 < words.length) {
          const combo2 = (words[i] + words[i + 1]).toUpperCase().replace(/[^A-Z0-9]/g, '');
          const m2 = parseSinglePlateCandidate(combo2);
          if (m2) return m2;
        }
        const single = words[i].toUpperCase().replace(/[^A-Z0-9]/g, '');
        const m1 = parseSinglePlateCandidate(single);
        if (m1) return m1;
      }
    }

    // Substring extraction within the same line (e.g. "F AA112AA 75")
    const intlSub = cleanLine.match(/(?:[A-Z]{1})?([A-Z]{2}[0-9][0-9OIZSBL][0-9][A-Z]{2})(?:[0-9]{2})?/);
    if (intlSub && intlSub[1]) {
      const subMatch = parseSinglePlateCandidate(intlSub[1]);
      if (subMatch) return subMatch;
    }

    const gbSub = cleanLine.match(/GB[0-9OIZSBL]{3,4}[A-Z]{1,2}/);
    if (gbSub) {
      const subMatch = parseSinglePlateCandidate(gbSub[0]);
      if (subMatch) return subMatch;
    }

    const snSub = cleanLine.match(/(?:DK|ZG|KD|TH|KL|SL)[0-9OIZSBL]{3,4}[A-Z]{1,2}/);
    if (snSub) {
      const subMatch = parseSinglePlateCandidate(snSub[0]);
      if (subMatch) return subMatch;
    }
  }

  return null;
}

export const anprOcrService = new AnprOcrService();
