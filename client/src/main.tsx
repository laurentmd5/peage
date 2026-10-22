import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './services/i18n.tsx';
import { anprOcrService } from './services/anprOcrService.ts';
import { aiVisionService } from './services/aiVisionService.ts';
import './index.css';

// Expose services on window for diagnostics, hardware automation & testing
if (typeof window !== 'undefined') {
  (window as any).anprOcrService = anprOcrService;
  (window as any).aiVisionService = aiVisionService;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
