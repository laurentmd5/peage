import { test, expect } from '@playwright/test';

test('Verify Tesseract.js ANPR OCR in real browser context', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

  await page.goto('http://localhost:3001');

  // Test inside the browser window
  const result = await page.evaluate(async () => {
    // Dynamically draw a test license plate AB-864-HM on a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;

    // White plate background with thin black border
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 400, 100);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 392, 92);

    // Blue European / CEDEAO band on left
    ctx.fillStyle = '#003399';
    ctx.fillRect(4, 4, 40, 92);

    // Black plate letters: AB-864-HM
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AB 864 HM', 220, 52);

    // Now call the bundled anprOcrService
    try {
      const service = (window as any).anprOcrService;
      if (!service) throw new Error('anprOcrService not found on window');
      const ocrResult = await service.recognizePlate(canvas);
      return { success: true, ocrResult };
    } catch (err: any) {
      return { success: false, error: err.message, stack: err.stack };
    }
  });

  console.log('Browser OCR Test Result:', JSON.stringify(result, null, 2));
  console.log('Browser Console Logs:', consoleMessages);

  expect(result.success).toBe(true);
  expect(result.ocrResult?.plateNumber).toBe('AB-864-HM');
  expect(result.ocrResult?.countryLabel).toBe('🌐 Transit / Import');
});
