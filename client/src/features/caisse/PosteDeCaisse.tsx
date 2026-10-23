import React, { useState, useEffect, useRef } from 'react';
import {
  VehicleDetection,
  TollTransaction,
  CashSession,
  User,
  PaymentMethod
} from '../../types.ts';
import { api } from '../../services/api.ts';
import { generateReceiptPdf, formatCurrency } from '../../services/receiptPdf.ts';
import { Modal } from '../../components/Modal.tsx';
import { useTranslation } from '../../services/i18n.tsx';
import { aiVisionService, VehicleDetectionResult } from '../../services/aiVisionService.ts';
import { anprOcrService } from '../../services/anprOcrService.ts';
import { hardwarePrintingService } from '../../services/hardwarePrintingService.ts';
import {
  Car,
  CreditCard,
  Banknote,
  Smartphone,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  ChevronRight,
  ShieldAlert,
  Clock,
  Sparkles,
  Camera,
  Video,
  Zap,
  Check,
  Settings,
  Copy
} from 'lucide-react';

interface PosteDeCaisseProps {
  currentUser: User | null;
  activeSession: CashSession | null;
  onRefreshSession: () => void;
}

type Step = 'WAITING' | 'DETECTED' | 'PAYMENT' | 'VALIDATED';

export const PosteDeCaisse: React.FC<PosteDeCaisseProps> = ({
  currentUser,
  activeSession,
  onRefreshSession
}) => {
  const { language, t, tCategory } = useTranslation();
  const [step, setStep] = useState<Step>('WAITING');
  const [detection, setDetection] = useState<VehicleDetection | null>(null);
  const [lastTransaction, setLastTransaction] = useState<TollTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<'VOIE-01' | 'VOIE-02' | 'VOIE-03' | 'VOIE-04'>('VOIE-01');
  const [isAutoDemoRunning, setIsAutoDemoRunning] = useState(false);

  // Real Hardware: AI Vision & Live Webcam states
  const [cameraMode, setCameraMode] = useState<'SIMULATION' | 'WEBCAM' | 'HIKVISION'>('SIMULATION');
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [liveDetection, setLiveDetection] = useState<VehicleDetectionResult | null>(null);
  const [webcamPlateInput, setWebcamPlateInput] = useState<string>('');
  const [isPlateManuallyEdited, setIsPlateManuallyEdited] = useState(false);
  const [isEditingPlate, setIsEditingPlate] = useState(false);
  const [editPlateValue, setEditPlateValue] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<any>(null);

  // Real Hardware: Industrial ANPR Camera states (Dynamic IP & Network, no hardcoded values)
  const [cameraIp, setCameraIp] = useState<string>(() => localStorage.getItem('toll_camera_ip') || '');
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string | null>(null);
  const hikvisionImgRef = useRef<HTMLImageElement | null>(null);
  const [isScanningHikvision, setIsScanningHikvision] = useState(false);
  const [hikvisionLiveDetection, setHikvisionLiveDetection] = useState<{
    plateNumber: string;
    countryLabel: string;
    confidence: number;
    categoryCode: string;
    categoryLabel: string;
    tariff: number;
    snapshotDataUrl: string;
  } | null>(null);
  const [hikvisionPlateInput, setHikvisionPlateInput] = useState<string>('');
  const [isHikvisionPlateEdited, setIsHikvisionPlateEdited] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{
    serverIps?: string[];
    primaryServerIp?: string;
    serverPort?: number;
    webhookUrls?: string[];
    activeCameraIp?: string | null;
  } | null>(null);
  const [showNetworkSettings, setShowNetworkSettings] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Real Hardware: Printing states
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);
  const [printerStatusMsg, setPrinterStatusMsg] = useState<string | null>(null);

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ESPECES');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [changeReturned, setChangeReturned] = useState<number>(0);
  const [mobilePhone, setMobilePhone] = useState<string>('77 123 45 67');
  const [mobileProcessing, setMobileProcessing] = useState(false);

  // Barrier state
  const [barrierOpen, setBarrierOpen] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);

  // Manual barrier open modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualReason, setManualReason] = useState('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Cancel transaction modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Receipt preview modal
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Calculate change on amount change
  useEffect(() => {
    if (detection && paymentMethod === 'ESPECES') {
      const diff = Math.max(0, amountPaid - detection.amountDue);
      setChangeReturned(diff);
    } else {
      setChangeReturned(0);
    }
  }, [amountPaid, detection, paymentMethod]);

  // Handle auto-close timer when barrier is open
  useEffect(() => {
    let timer: any;
    if (barrierOpen && step === 'VALIDATED') {
      setAutoCloseCountdown(5);
      timer = setInterval(() => {
        setAutoCloseCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            setBarrierOpen(false);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [barrierOpen, step]);

  // 1. Détecter un véhicule (Simulateur ANPR)
  const handleDetectVehicle = async (forcedPlate?: string, forcedCategory?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.detectVehicle(activeSession?.boothId || selectedLane, forcedPlate, forcedCategory);
      setDetection(result);
      setAmountPaid(result.amountDue); // default exact amount
      setStep('DETECTED');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 1b. Démo automatique end-to-end (Taxi Bissau -> Wave -> Reçu & Barrière)
  const handleRunAutoDemo = async () => {
    if (loading || isAutoDemoRunning) return;
    setIsAutoDemoRunning(true);
    setError(null);
    try {
      // Étape 1 : Détection du Taxi Bissau
      const result = await api.detectVehicle(selectedLane, 'GB-2345-AF', 'TAXI');
      setDetection(result);
      setAmountPaid(result.amountDue);
      setStep('DETECTED');

      await new Promise(r => setTimeout(r, 1200));

      // Étape 2 : Passage au paiement Wave
      setStep('PAYMENT');
      setPaymentMethod('WAVE');

      await new Promise(r => setTimeout(r, 1000));

      // Étape 3 : Traitement du paiement mobile
      setLoading(true);
      setMobileProcessing(true);
      await new Promise(r => setTimeout(r, 1200));
      setMobileProcessing(false);

      const tx = await api.processPayment({
        sessionId: activeSession?.id,
        laneId: selectedLane,
        plateNumber: result.plateNumber,
        categoryCode: result.categoryCode,
        categoryLabel: result.categoryLabel,
        amountDue: result.amountDue,
        amountPaid: result.amountDue,
        paymentMethod: 'WAVE',
        cashierId: currentUser?.id || 'u-caisse1',
        cashierName: currentUser?.fullName || 'Awa Diop',
        ticketNumber: result.ticketNumber,
        qrCodeData: result.qrCodeData
      });

      setLastTransaction(tx);
      setBarrierOpen(true);
      setStep('VALIDATED');
      onRefreshSession();

      // Hardware Auto-Print on Payment
      if (autoPrintEnabled) {
        hardwarePrintingService.printTicket({
          ticketNumber: tx.ticketNumber,
          laneId: selectedLane,
          plateNumber: tx.plateNumber,
          categoryCode: tx.categoryCode,
          categoryLabel: tx.categoryLabel,
          amountDue: tx.amountDue,
          amountPaid: tx.amountPaid,
          changeReturned: tx.changeReturned,
          paymentMethod: tx.paymentMethod,
          cashierName: currentUser?.fullName || 'Awa Diop',
          timestamp: tx.createdAt,
          qrCodeData: tx.qrCodeData
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsAutoDemoRunning(false);
    }
  };

  // 2. Valider le paiement
  const handleProcessPayment = async () => {
    if (!detection) return;

    if (paymentMethod === 'ESPECES' && amountPaid < detection.amountDue) {
      setError(`Le montant reçu (${formatCurrency(amountPaid)} FCFA) est inférieur au montant dû (${formatCurrency(detection.amountDue)} FCFA)`);
      return;
    }

    setLoading(true);
    setError(null);

    // Simulate mobile processing delay for Wave / Orange Money
    if (paymentMethod === 'WAVE' || paymentMethod === 'ORANGE_MONEY') {
      setMobileProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setMobileProcessing(false);
    }

    try {
      const tx = await api.processPayment({
        sessionId: activeSession?.id,
        laneId: activeSession?.boothId || 'CAISSE-01',
        plateNumber: detection.plateNumber,
        categoryCode: detection.categoryCode,
        categoryLabel: detection.categoryLabel,
        amountDue: detection.amountDue,
        amountPaid: paymentMethod === 'ESPECES' ? amountPaid : detection.amountDue,
        paymentMethod,
        cashierId: currentUser?.id || 'u-caisse1',
        cashierName: currentUser?.fullName || 'Caissier',
        ticketNumber: detection.ticketNumber,
        qrCodeData: detection.qrCodeData
      });

      setLastTransaction(tx);
      setBarrierOpen(true);
      setStep('VALIDATED');
      onRefreshSession();

      // Hardware Auto-Print on Payment
      if (autoPrintEnabled) {
        hardwarePrintingService.printTicket({
          ticketNumber: tx.ticketNumber,
          laneId: activeSession?.boothId || 'CAISSE-01',
          plateNumber: tx.plateNumber,
          categoryCode: tx.categoryCode,
          categoryLabel: tx.categoryLabel,
          amountDue: tx.amountDue,
          amountPaid: tx.amountPaid,
          changeReturned: tx.changeReturned,
          paymentMethod: tx.paymentMethod,
          cashierName: currentUser?.fullName || 'Caissier',
          timestamp: tx.createdAt,
          qrCodeData: tx.qrCodeData
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Real Hardware: Webcam & AI Vision Controllers
  const startWebcam = async () => {
    try {
      setIsModelLoading(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsWebcamActive(true);

      // Preload AI Model & Reset OCR
      aiVisionService.resetOcr();
      await aiVisionService.loadModel();
      setIsModelLoading(false);

      // Continuous detection loop
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
        const res = await aiVisionService.detectFromVideo(videoRef.current);
        if (res) {
          setLiveDetection(res);
        }
      }, 700);
    } catch (err: any) {
      setIsModelLoading(false);
      setError(`Accès caméra non disponible: ${err.message}.`);
    }
  };

  const stopWebcam = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    aiVisionService.resetOcr();
    setIsWebcamActive(false);
    setLiveDetection(null);
    setWebcamPlateInput('');
    setIsPlateManuallyEdited(false);
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  // Synchronize OCR recognized plate into manual input state (only if cashier hasn't manually edited)
  useEffect(() => {
    if (liveDetection?.isOcrLiveRead && liveDetection.plateNumberSuggestion) {
      if (!isPlateManuallyEdited) {
        setWebcamPlateInput(liveDetection.plateNumberSuggestion);
      }
    }
  }, [liveDetection?.isOcrLiveRead, liveDetection?.plateNumberSuggestion, isPlateManuallyEdited]);

  const handleUnlockPlate = () => {
    aiVisionService.unlockPlate();
    setWebcamPlateInput('');
    setIsPlateManuallyEdited(false);
  };

  const handleUnlockVehicle = () => {
    aiVisionService.unlockVehicle();
  };

  // Listen for real-time Hikvision Webhook detections via Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/dashboard/events');
      const onVehicleDetected = (e: any) => {
        try {
          const detected = JSON.parse(e.data);
          if (detected) {
            setDetection(detected);
            setAmountPaid(detected.amountDue);
            setStep('DETECTED');
            setCameraStatusMsg(`✅ Détection caméra reçue : ${detected.plateNumber} [${detected.categoryCode}]`);
          }
        } catch (_) {}
      };

      eventSource.addEventListener('camera:vehicle-detected', onVehicleDetected);
      eventSource.addEventListener('hikvision:vehicle-detected', onVehicleDetected);
      eventSource.addEventListener('vehicle:detected', (e: any) => {
        try {
          const detected = JSON.parse(e.data);
          if (cameraMode === 'HIKVISION' && step === 'WAITING' && detected) {
            setDetection(detected);
            setAmountPaid(detected.amountDue);
            setStep('DETECTED');
          }
        } catch (_) {}
      });
    } catch (_) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [cameraMode, step]);

  // Fetch dynamic camera and network status on mount
  useEffect(() => {
    api.getCameraStatus().then(status => {
      if (status) {
        setNetworkInfo({
          serverIps: status.serverIps,
          primaryServerIp: status.primaryServerIp,
          serverPort: status.serverPort,
          webhookUrls: status.webhookUrls,
          activeCameraIp: status.activeCameraIp
        });
        if (!cameraIp && status.activeCameraIp) {
          setCameraIp(status.activeCameraIp);
          localStorage.setItem('toll_camera_ip', status.activeCameraIp);
        }
      }
    }).catch(() => {});
  }, [cameraIp]);

  // Automated & On-Demand AI OCR scanning on Hikvision Live Stream
  const scanHikvisionFrame = async (immediateConfirm = false) => {
    if (!hikvisionImgRef.current || step !== 'WAITING' || isScanningHikvision) return;
    try {
      setIsScanningHikvision(true);
      const img = hikvisionImgRef.current;
      if (!img.naturalWidth || !img.naturalHeight) return;

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      // Primary candidate: central target reticle zone (excludes top OSD timestamp y<18% and bottom OSD name y>82%)
      const rx = Math.round(canvas.width * 0.15);
      const ry = Math.round(canvas.height * 0.22);
      const rw = Math.round(canvas.width * 0.70);
      const rh = Math.round(canvas.height * 0.55);

      const ocrResult = await anprOcrService.recognizePlate(canvas, [rx, ry, rw, rh]);
      const snapshotUrl = canvas.toDataURL('image/jpeg', 0.88);

      if (ocrResult && ocrResult.plateNumber && ocrResult.plateNumber.length >= 4) {
        console.log('[ANPR OCR] 🎯 Plaque lue sur le flux Hikvision:', ocrResult.plateNumber);

        setHikvisionLiveDetection({
          plateNumber: ocrResult.plateNumber,
          countryLabel: ocrResult.countryLabel || 'Auto',
          confidence: ocrResult.confidence,
          categoryCode: 'CAT2',
          categoryLabel: 'Voitures & Pick-up',
          tariff: 500,
          snapshotDataUrl: snapshotUrl
        });

        if (!isHikvisionPlateEdited) {
          setHikvisionPlateInput(ocrResult.plateNumber);
        }

        if (immediateConfirm) {
          await handleConfirmHikvisionDetection(ocrResult.plateNumber, snapshotUrl);
        } else {
          setCameraStatusMsg(`✅ Plaque ciblée : ${ocrResult.plateNumber} (${ocrResult.countryLabel || 'Auto'})`);
        }
      } else if (immediateConfirm) {
        setCameraStatusMsg(
          language === 'fr'
            ? '⚠️ Aucune plaque lisible détectée dans le viseur. Vérifiez le cadrage ou saisissez-la directement.'
            : '⚠️ No readable plate detected in viewfinder. Adjust angle or enter it manually.'
        );
      }
    } catch (e) {
      console.warn('OCR error on Hikvision frame:', e);
    } finally {
      setIsScanningHikvision(false);
    }
  };

  const handleConfirmHikvisionDetection = async (overridePlate?: string, overrideSnapshot?: string) => {
    const rawPlate = (overridePlate || hikvisionPlateInput || hikvisionLiveDetection?.plateNumber || '').trim().toUpperCase();
    if (!rawPlate) {
      setError(language === 'fr' ? 'Veuillez scanner ou saisir une plaque valide.' : 'Please scan or enter a valid plate.');
      return;
    }

    const finalSnapshot = overrideSnapshot || hikvisionLiveDetection?.snapshotDataUrl;
    setLoading(true);
    setError(null);
    try {
      const result = await api.detectVehicle(selectedLane, rawPlate, 'CAT2', finalSnapshot);
      if (finalSnapshot) {
        result.vehicleImageUrl = finalSnapshot; // Real picture captured by the camera!
      }
      setDetection(result);
      setAmountPaid(result.amountDue);
      setStep('DETECTED');
      setCameraStatusMsg(`✅ Plaque validée avec photo réelle : ${rawPlate} (Catégorie 2 - 500 FCFA)`);
    } catch (err: any) {
      setError(`Erreur détection: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Continuous auto-scan on Hikvision live feed while in waiting state
  useEffect(() => {
    let interval: any = null;
    if (cameraMode === 'HIKVISION' && step === 'WAITING') {
      anprOcrService.init().catch(() => {});
      interval = setInterval(() => {
        scanHikvisionFrame(false);
      }, 1400);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cameraMode, step, isScanningHikvision, isHikvisionPlateEdited]);

  const handleTestHikvisionWebhook = async () => {
    setIsTestingHikvision(true);
    setCameraStatusMsg(null);
    try {
      const res = await api.simulateHikvisionWebhook({
        laneId: selectedLane,
        plateNumber: 'AB-864-HM',
        vehicleType: 'SUV',
        confidence: 98
      });
      setDetection(res.detection);
      setAmountPaid(res.detection.amountDue);
      setStep('DETECTED');
      setCameraStatusMsg('✅ Détection simulée reçue avec succès depuis la caméra ANPR !');
    } catch (err: any) {
      setError(`Erreur simulation caméra: ${err.message}`);
    } finally {
      setIsTestingHikvision(false);
    }
  };

  const handleConfirmWebcamDetection = async () => {
    if (!liveDetection) return;
    setLoading(true);
    try {
      const manualInputClean = webcamPlateInput.trim().toUpperCase();
      const finalPlate = (isPlateManuallyEdited && manualInputClean
        ? manualInputClean
        : (manualInputClean || liveDetection.plateNumberSuggestion || liveDetection.fallbackPlate || 'GB-4512-AZ'));

      const result = await api.detectVehicle(selectedLane, finalPlate, liveDetection.categoryCode);
      if (liveDetection.snapshotDataUrl) {
        result.vehicleImageUrl = liveDetection.snapshotDataUrl;
      }
      result.confidence = liveDetection.confidence;
      setDetection(result);
      setAmountPaid(result.amountDue);
      setStep('DETECTED');
      stopWebcam();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectThermalPrinter = async () => {
    const res = await hardwarePrintingService.connectThermalPrinter();
    setPrinterStatusMsg(res.message);
    setTimeout(() => setPrinterStatusMsg(null), 5000);
  };

  // 3. Ouvrir manuellement la barrière
  const handleManualOpenBarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReason.trim()) return;

    setLoading(true);
    try {
      const res = await api.openBarrierManually(activeSession?.boothId || 'CAISSE-01', manualReason);
      setBarrierOpen(true);
      setManualSuccessMsg(res.message);
      setManualReason('');
      setTimeout(() => {
        setIsManualModalOpen(false);
        setManualSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Annuler la transaction
  const handleCancelTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastTransaction || !cancelReason.trim()) return;

    setLoading(true);
    try {
      const updated = await api.cancelTransaction(lastTransaction.id, cancelReason);
      setLastTransaction(updated);
      setIsCancelModalOpen(false);
      setCancelReason('');
      onRefreshSession();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Imprimer / Télécharger Reçu PDF
  const handleDownloadReceipt = async () => {
    if (!lastTransaction) return;
    const doc = await generateReceiptPdf(lastTransaction, language);
    doc.save(`Recu-Peage-${lastTransaction.ticketNumber}.pdf`);
  };

  // Réinitialiser pour véhicule suivant
  const handleNextVehicle = () => {
    setDetection(null);
    setStep('WAITING');
    setBarrierOpen(false);
    setAutoCloseCountdown(null);
    setError(null);
    setHikvisionLiveDetection(null);
    setHikvisionPlateInput('');
    setIsHikvisionPlateEdited(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner Actions & Emergency Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">{t('caisseStatusLabel')}</span>
            <span className="px-3 py-1 bg-slate-800 text-emerald-400 font-mono font-bold rounded-lg border border-slate-700">
              {activeSession?.boothId || 'CAISSE-01'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{t('barrierStatusLabel')}</span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${
                barrierOpen
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${barrierOpen ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`}></span>
              {barrierOpen ? t('barrierOpenState') : t('barrierClosedState')}
            </span>
          </div>
        </div>

        {/* Real Hardware & Quick Override Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Print Toggle */}
          <button
            type="button"
            onClick={() => setAutoPrintEnabled(!autoPrintEnabled)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              autoPrintEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Activer/Désactiver l'impression automatique du reçu"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{autoPrintEnabled ? t('autoPrintActive') : t('autoPrintInactive')}</span>
          </button>

          {/* Connect Thermal Printer Button */}
          <button
            type="button"
            onClick={handleConnectThermalPrinter}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Associer une imprimante thermique ESC/POS 80mm sur port USB/Série"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('connectThermalBtn')}</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>{t('manualOpenBtn')}</span>
          </button>

          {lastTransaction && lastTransaction.status === 'COMPLETED' && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{t('cancelLastTxBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {printerStatusMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{printerStatusMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">{t('closeBtn')}</button>
        </div>
      )}

      {/* Main Grid: Left Flow Station, Right Barrier & Terminal Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Interactive Cashier Flow */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: EN ATTENTE DE VÉHICULE */}
          {step === 'WAITING' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-6">
              {/* Mode Switcher: Demo Categories vs Live AI Camera (Webcam) vs Hikvision Smart IPC */}
              <div className="flex items-center justify-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCameraMode('SIMULATION');
                    stopWebcam();
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    cameraMode === 'SIMULATION'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('modeSimulation')}</span>
                </button>

                <button
                  type="button"
                  id="btn-switch-webcam"
                  onClick={() => {
                    setCameraMode('WEBCAM');
                    startWebcam();
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    cameraMode === 'WEBCAM'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('modeWebcam')}</span>
                </button>

                <button
                  type="button"
                  id="btn-switch-hikvision"
                  onClick={() => {
                    setCameraMode('HIKVISION');
                    stopWebcam();
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    cameraMode === 'HIKVISION'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm ring-1 ring-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('modeAnprCamera')}</span>
                </button>
              </div>

              {/* VIEW 1: LIVE WEBCAM & AI VISION HUD */}
              {cameraMode === 'WEBCAM' && (
                <div className="space-y-4 max-w-xl mx-auto">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-black aspect-video flex items-center justify-center shadow-2xl">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Scanning Line Animation */}
                    <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-[bounce_2s_infinite]"></div>

                    {/* HUD Overlay */}
                    <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-mono text-emerald-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>VISION IA TEMPS RÉEL (EDGE)</span>
                    </div>

                    {/* Frozen Vehicle Snapshot Indicator */}
                    {liveDetection?.isVehicleLocked && (
                      <div className="absolute top-3 right-3 bg-slate-900/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-emerald-500/60 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5 shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>🔒 PHOTO VÉHICULE FIGÉE</span>
                        <button
                          type="button"
                          onClick={handleUnlockVehicle}
                          title="Reprendre une nouvelle photo du véhicule"
                          className="ml-1 text-slate-400 hover:text-amber-300 underline text-[9px] cursor-pointer"
                        >
                          Reprendre
                        </button>
                      </div>
                    )}

                    {/* Center Optical LAPI Reticle */}
                    <div className={`absolute inset-x-[15%] inset-y-[25%] border-2 rounded-xl pointer-events-none flex flex-col justify-between p-2.5 transition-all duration-300 ${
                      liveDetection?.isOcrLiveRead
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(52,211,153,0.35)]'
                        : 'border-dashed border-amber-400/60 bg-amber-500/5 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
                    }`}>
                      <div className={`flex justify-between items-center text-[10px] font-mono font-bold px-2 py-0.5 rounded backdrop-blur-sm border transition-colors ${
                        liveDetection?.isOcrLiveRead
                          ? 'text-emerald-300 bg-slate-950/90 border-emerald-500/40'
                          : 'text-amber-300 bg-slate-950/80 border-amber-500/30'
                      }`}>
                        <span>[ CIBLE LAPI / ANPR ]</span>
                        {liveDetection?.isOcrLiveRead ? (
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                              <span>{liveDetection.isPlateLocked ? '🔒 PLAQUE VERROUILLÉE :' : '✅ PLAQUE LUE :'}</span>
                              <span className="text-white px-1.5 rounded bg-emerald-500/30 border border-emerald-400/50">{liveDetection.plateNumberSuggestion}</span>
                            </span>
                            <button
                              type="button"
                              onClick={handleUnlockPlate}
                              title={language === 'fr' ? "Relire une plaque / Déverrouiller" : "Rescan plate / Unlock"}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] border border-slate-600 pointer-events-auto cursor-pointer"
                            >
                              {language === 'fr' ? '🔄 Relire' : '🔄 Rescan'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-amber-300 animate-pulse text-[9px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                            <span>{language === 'fr' ? 'Centrer la plaque dans le viseur' : 'Center plate in viewfinder'}</span>
                          </span>
                        )}
                      </div>
                      <div className={`flex justify-between text-[10px] font-mono transition-colors ${
                        liveDetection?.isOcrLiveRead ? 'text-emerald-400' : 'text-amber-400/70'
                      }`}>
                        <span>└ ─ ─</span>
                        <span>─ ─ ┘</span>
                      </div>
                    </div>

                    {/* AI Vehicle Detection Banner when an object is detected */}
                    {liveDetection && (
                      <div className={`absolute bottom-3 inset-x-3 bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl transition-all ${
                        liveDetection.isOcrLiveRead ? 'border-emerald-500/80 shadow-emerald-500/10' : 'border-amber-500/50'
                      }`}>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                            liveDetection.isOcrLiveRead ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {liveDetection.categoryCode === 'CAT1' ? '🚖' : (liveDetection.categoryCode === 'CAT3' ? '🚌' : (liveDetection.categoryCode === 'CAT4' ? '🚚' : (liveDetection.categoryCode === 'CAT5' ? '🚛' : '🚗')))}
                          </div>
                          <div className="text-left flex-1">
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>[{liveDetection.categoryCode}] {liveDetection.categoryLabel}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                                {liveDetection.confidence}%
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-400 font-mono font-bold flex flex-wrap items-center gap-2 mt-0.5">
                              <span>{language === 'fr' ? 'Tarif :' : 'Fee:'} {formatCurrency(liveDetection.tariff)} FCFA</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-slate-300 font-mono font-bold">{t('plateLabel')} :</span>
                              <input
                                type="text"
                                id="input-webcam-plate"
                                value={webcamPlateInput}
                                onChange={(e) => {
                                  setWebcamPlateInput(e.target.value.toUpperCase());
                                  setIsPlateManuallyEdited(true);
                                }}
                                placeholder={liveDetection.plateNumberSuggestion || liveDetection.fallbackPlate || 'Ex: AB-093-FB'}
                                className={`w-32 px-2 py-0.5 bg-slate-950 border font-mono font-bold text-xs rounded outline-none transition-colors ${
                                  liveDetection.isOcrLiveRead
                                    ? 'border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                                    : 'border-slate-700 text-white focus:border-amber-400'
                                }`}
                              />
                              {isPlateManuallyEdited && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono font-bold">
                                  {language === 'fr' ? '✏️ Manuel' : '✏️ Manual'}
                                </span>
                              )}
                              {liveDetection.isOcrLiveRead ? (
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <span>{liveDetection.isPlateLocked ? '🔒 LAPI' : '✨ LAPI'}</span>
                                  {liveDetection.ocrCountryLabel && (
                                    <span className="text-[9px] font-normal">{liveDetection.ocrCountryLabel}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-400 flex items-center gap-1 font-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                                  <span>{language === 'fr' ? '(Lecture OCR en cours...)' : '(OCR Reading in progress...)'}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          id="btn-confirm-webcam-vehicle"
                          onClick={handleConfirmWebcamDetection}
                          className="w-full sm:w-auto px-4 py-2 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/30 font-black cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>
                            {language === 'fr' ? 'Valider' : 'Confirm'} {webcamPlateInput || liveDetection.plateNumberSuggestion || (language === 'fr' ? 'Véhicule' : 'Vehicle')}
                          </span>
                        </button>
                      </div>
                    )}

                    {!liveDetection && (
                      <div className="absolute bottom-3 inset-x-3 bg-slate-900/80 backdrop-blur-sm p-2 rounded-lg text-center text-xs text-slate-300">
                        {isModelLoading ? t('cameraLoadingModel') : t('waitingWebcamVehicle')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    {isWebcamActive ? (
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                      >
                        {t('stopWebcamBtn')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startWebcam}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{t('startWebcamBtn')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 3: HIKVISION REAL INDUSTRIAL LPR CAMERA */}
              {cameraMode === 'HIKVISION' && (
                <div className="space-y-4 max-w-xl mx-auto text-left">
                  <div className="bg-slate-950 border border-blue-500/40 rounded-2xl p-5 space-y-4 shadow-2xl">
                    {/* Camera Header Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold border border-blue-500/30">
                          <Video className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{t('anprCameraTitle')}</span>
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] border border-blue-500/40 font-bold">
                              {t('anprCameraBadge')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {t('anprCameraSubtitle')} • Voie : <span className="text-emerald-400 font-bold">{selectedLane}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowNetworkSettings(prev => !prev)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors border ${
                            showNetworkSettings
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                          }`}
                          title={language === 'fr' ? "Paramètres de liaison et URL Webhook" : "Network link and Webhook URL settings"}
                        >
                          <Settings className="w-3 h-3 text-blue-400" />
                          <span>{language === 'fr' ? 'Liaison Réseau' : 'Network Link'}</span>
                        </button>

                        <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                          <span className="text-[10px] font-mono font-bold text-emerald-400">
                            {language === 'fr' ? 'SURVEILLANCE ACTIVE' : 'ACTIVE SURVEILLANCE'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Dynamic Network & Webhook Configuration */}
                    {showNetworkSettings && (
                      <div className="bg-slate-900/95 border border-blue-500/30 rounded-xl p-3.5 space-y-3 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="font-bold text-white flex items-center gap-2">
                            <Settings className="w-4 h-4 text-blue-400" />
                            <span>{language === 'fr' ? 'Configuration Réseau Dynamique' : 'Dynamic Network Configuration'}</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400">
                            {language === 'fr' ? 'IP Serveur :' : 'Server IP:'} {networkInfo?.primaryServerIp || window.location.hostname}
                          </span>
                        </div>

                        {/* URL Webhook à renseigner dans la caméra */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            {language === 'fr' ? 'URL Webhook (à saisir dans le menu HTTP / Alarm Server de votre caméra) :' : 'Webhook URL (to enter in your camera HTTP / Alarm Server settings):'}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={
                                networkInfo?.webhookUrls?.[0] ||
                                `http://${window.location.hostname || '127.0.0.1'}:3001/api/toll/camera-webhook`
                              }
                              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-blue-300 select-all"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const url =
                                  networkInfo?.webhookUrls?.[0] ||
                                  `http://${window.location.hostname || '127.0.0.1'}:3001/api/toll/camera-webhook`;
                                navigator.clipboard.writeText(url);
                                setCopiedUrl(true);
                                setTimeout(() => setCopiedUrl(false), 2000);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5"
                            >
                              {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedUrl ? (language === 'fr' ? 'Copié !' : 'Copied!') : (language === 'fr' ? 'Copier' : 'Copy')}</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {language === 'fr'
                              ? "💡 Cette URL s'adapte automatiquement à l'adresse IP réelle de la machine sans aucun code en dur."
                              : "💡 This URL automatically adapts to the host machine's actual IP address with zero hardcoded values."}
                          </p>
                        </div>

                        {/* IP Caméra pour le flux visuel */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-slate-300">
                              {language === 'fr' ? 'Adresse IP de la Caméra (Optionnel, pour le retour vidéo) :' : 'Camera IP Address (Optional, for live video feed):'}
                            </label>
                            {networkInfo?.activeCameraIp && (
                              <span className="text-[10px] font-mono text-emerald-400">
                                {language === 'fr' ? 'Détectée automatiquement :' : 'Auto-detected:'} {networkInfo.activeCameraIp}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={cameraIp}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                setCameraIp(val);
                                localStorage.setItem('toll_camera_ip', val);
                              }}
                              placeholder="Ex: 192.168.1.64 ou 10.0.0.50"
                              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white placeholder-slate-500"
                            />
                            {networkInfo?.activeCameraIp && cameraIp !== networkInfo.activeCameraIp && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCameraIp(networkInfo.activeCameraIp!);
                                  localStorage.setItem('toll_camera_ip', networkInfo.activeCameraIp!);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                              >
                                {language === 'fr' ? "Utiliser l'IP détectée" : "Use auto-detected IP"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {cameraStatusMsg && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-emerald-300 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{cameraStatusMsg}</span>
                      </div>
                    )}

                    {/* Camera Live Preview & Optical Targeting */}
                    <div className="relative rounded-xl overflow-hidden border border-blue-500/40 bg-black aspect-video flex items-center justify-center shadow-inner group">
                      {/* Live Continuous Video Stream from Real Hikvision ANPR Camera */}
                      <img
                        ref={hikvisionImgRef}
                        crossOrigin="anonymous"
                        src="/api/toll/camera-stream"
                        alt="Camera Live Feed"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          setTimeout(() => {
                            target.src = `/api/toll/camera-stream?t=${Date.now()}`;
                          }, 2000);
                        }}
                        className="w-full h-full object-cover"
                      />

                      {/* Scanning Line Animation (like Webcam) */}
                      <div className="absolute inset-x-0 h-0.5 bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-[bounce_2s_infinite] pointer-events-none"></div>

                      {/* Optical HUD Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/60">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-900/90 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>{t('anprLaneConnected')}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-900/90 text-emerald-300 border border-emerald-500/30">
                            {t('anprLiveOcrActive')}
                          </span>
                        </div>

                        {/* Center Target Box */}
                        <div className={`mx-auto w-4/5 sm:w-3/4 h-24 border-2 rounded-xl flex items-center justify-center transition-all ${
                          hikvisionLiveDetection
                            ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_25px_rgba(52,211,153,0.4)]'
                            : 'border-dashed border-blue-400/60 bg-blue-500/5'
                        }`}>
                          {hikvisionLiveDetection ? (
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-300 font-black flex items-center gap-1.5 bg-slate-950/95 px-3 py-1.5 rounded-lg border border-emerald-400 shadow-xl text-xs font-mono">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                <span>PLAQUE :</span>
                                <span className="text-white px-2 py-0.5 rounded bg-emerald-500/30 border border-emerald-400 font-mono tracking-widest text-sm font-black">
                                  {hikvisionPlateInput || hikvisionLiveDetection.plateNumber}
                                </span>
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] font-mono text-blue-300 bg-slate-950/90 px-2.5 py-1 rounded border border-blue-500/30 flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-blue-400" />
                              <span>{t('anprDetectionZone')}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                          <span>VOIE : {selectedLane}</span>
                          <span>{hikvisionLiveDetection ? '✅ CIBLE ACQUISE' : t('anprWaitingVehicle')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Live Plate Detection Banner & Confirm Action */}
                    {hikvisionLiveDetection && (
                      <div className="p-3.5 rounded-xl bg-slate-900/95 border-2 border-emerald-500/70 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="w-12 h-12 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
                            {hikvisionLiveDetection.snapshotDataUrl ? (
                              <img src={hikvisionLiveDetection.snapshotDataUrl} alt="Vehicle Crop" className="w-full h-full object-cover" />
                            ) : (
                              '🚗'
                            )}
                          </div>
                          <div className="text-left flex-1">
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>[CAT2] Voitures & Pick-up</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                                {hikvisionLiveDetection.confidence}%
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {hikvisionLiveDetection.countryLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[11px] text-slate-300 font-mono font-bold">Plaque :</span>
                              <input
                                type="text"
                                id="input-hikvision-plate"
                                value={hikvisionPlateInput}
                                onChange={(e) => {
                                  setHikvisionPlateInput(e.target.value.toUpperCase());
                                  setIsHikvisionPlateEdited(true);
                                }}
                                placeholder="AA-331-CM"
                                className="bg-slate-950 border border-emerald-500/60 text-white font-mono font-black text-sm px-2.5 py-1 rounded-lg uppercase tracking-wider w-36 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setHikvisionLiveDetection(null);
                                  setHikvisionPlateInput('');
                                  setIsHikvisionPlateEdited(false);
                                }}
                                className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                              >
                                🔄 Relire
                              </button>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          id="btn-confirm-hikvision-vehicle"
                          onClick={() => handleConfirmHikvisionDetection()}
                          disabled={loading}
                          className="w-full sm:w-auto px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Zap className="w-4 h-4 fill-slate-950" />
                          <span>
                            {language === 'fr' ? 'Valider' : 'Confirm'} {hikvisionPlateInput || hikvisionLiveDetection.plateNumber} (500 FCFA)
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Clean Status Footer & Instant Manual/Auto Scan Trigger */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>{isScanningHikvision ? (language === 'fr' ? 'Analyse OCR en cours...' : 'OCR Reading in progress...') : t('anprWaitingVehicle')}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="btn-scan-hikvision-now"
                          onClick={() => scanHikvisionFrame(true)}
                          disabled={isScanningHikvision}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-105 transition-all cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                          <span>{language === 'fr' ? '⚡ Détecter la Plaque' : '⚡ Detect Plate'}</span>
                        </button>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          {t('anprAutomatedBadge')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: STANDARD 5 CATEGORIES SELECTOR */}
              {cameraMode === 'SIMULATION' && (
                <>
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 radar-pulse"></div>
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center">
                      <Radio className="w-8 h-8 text-emerald-400 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-white">{t('waitingTitle')}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {language === 'fr' 
                        ? 'Sélectionnez un véhicule pour tester la détection ANPR ou lancez la démonstration automatique :'
                        : 'Select a test vehicle for ANPR detection or launch the automated live demo:'}
                    </p>
                  </div>

                  {/* Quick Launch Test Vehicles (5 Catégories Officielles AREZKI BISSAU) */}
                  <div className="space-y-2 max-w-2xl mx-auto">
                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider text-center">
                      {language === 'fr' ? 'Sélection Rapide des 5 Catégories AREZKI :' : 'Quick Select AREZKI 5 Categories:'}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {/* Cat 1: Moto / Taxi */}
                      <button
                        id="btn-detect-taxi"
                        onClick={() => handleDetectVehicle('GB-2345-AF', 'CAT1')}
                        disabled={loading || isAutoDemoRunning}
                        className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-xl text-center transition-all hover:scale-105 flex flex-col items-center gap-1 group disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center text-base">🚖</div>
                        <div className="text-[11px] font-bold text-amber-300">Taxi Bissau (Cat 1)</div>
                        <div className="text-[10px] font-mono text-amber-400 font-bold">250 FCFA</div>
                      </button>

                      {/* Cat 2: Voitures & Pickups */}
                      <button
                        id="btn-detect-vl"
                        onClick={() => handleDetectVehicle('GB-4512-AZ', 'CAT2')}
                        disabled={loading || isAutoDemoRunning}
                        className="p-2.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 rounded-xl text-center transition-all hover:scale-105 flex flex-col items-center gap-1 group disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-sky-400/20 flex items-center justify-center text-base">🚗</div>
                        <div className="text-[11px] font-bold text-sky-300">{language === 'fr' ? 'Cat 2 : Voiture/Pickup' : 'Cat 2: Car/Pickup'}</div>
                        <div className="text-[10px] font-mono text-sky-400 font-bold">500 FCFA</div>
                      </button>

                      {/* Cat 3: Canter / Bus */}
                      <button
                        id="btn-detect-canter"
                        onClick={() => handleDetectVehicle('GB-6789-DX', 'CAT3')}
                        disabled={loading || isAutoDemoRunning}
                        className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/40 rounded-xl text-center transition-all hover:scale-105 flex flex-col items-center gap-1 group disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-400/20 flex items-center justify-center text-base">🚌</div>
                        <div className="text-[11px] font-bold text-indigo-300">{language === 'fr' ? 'Cat 3 : Canter/Bus' : 'Cat 3: Bus/Minivan'}</div>
                        <div className="text-[10px] font-mono text-indigo-400 font-bold">1 500 FCFA</div>
                      </button>

                      {/* Cat 4: Camions 7t-20t */}
                      <button
                        id="btn-detect-pl"
                        onClick={() => handleDetectVehicle('GB-8765-BZ', 'CAT4')}
                        disabled={loading || isAutoDemoRunning}
                        className="p-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/40 rounded-xl text-center transition-all hover:scale-105 flex flex-col items-center gap-1 group disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-400/20 flex items-center justify-center text-base">🚚</div>
                        <div className="text-[11px] font-bold text-purple-300">{language === 'fr' ? 'Cat 4 : Camion 7-20t' : 'Cat 4: Truck 7-20t'}</div>
                        <div className="text-[10px] font-mono text-purple-400 font-bold">5 000 FCFA</div>
                      </button>

                      {/* Cat 5: Semi-remorques >20t */}
                      <button
                        id="btn-detect-semi"
                        onClick={() => handleDetectVehicle('GB-9900-HB', 'CAT5')}
                        disabled={loading || isAutoDemoRunning}
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 rounded-xl text-center transition-all hover:scale-105 flex flex-col items-center gap-1 group disabled:opacity-50 col-span-2 sm:col-span-1"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-400/20 flex items-center justify-center text-base">🚛</div>
                        <div className="text-[11px] font-bold text-rose-300">{language === 'fr' ? 'Cat 5 : Semi >20t' : 'Cat 5: Semi-Trailer >20t'}</div>
                        <div className="text-[10px] font-mono text-rose-400 font-bold">10 000 FCFA</div>
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons: Automated Demo & Random Vehicle */}
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      id="btn-auto-demo"
                      onClick={handleRunAutoDemo}
                      disabled={loading || isAutoDemoRunning}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isAutoDemoRunning ? (language === 'fr' ? 'Démo en cours...' : 'Demo running...') : (language === 'fr' ? '🚀 Démo Automatique 1-Clic' : '🚀 Run Automated Demo (8s)')}</span>
                    </button>

                    <button
                      id="btn-simulate-arrival"
                      onClick={() => handleDetectVehicle()}
                      disabled={loading || isAutoDemoRunning}
                      className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <Car className="w-4 h-4 text-slate-400" />
                      <span>{t('simulateArrivalBtn')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2: DÉTECTION & ANPR */}
          {step === 'DETECTED' && detection && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                  <h2 className="text-lg font-bold text-white">{t('vehicleDetectedTitle')}</h2>
                </div>
                <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-mono">
                  {t('confidenceLabel')} {detection.confidence}%
                </span>
              </div>

              {/* Vehicle & Plate Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Vehicle Simulated or Real Image */}
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video flex items-center justify-center">
                  <img
                    src={detection.vehicleImageUrl}
                    alt={detection.categoryLabel}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-slate-200 border border-slate-700 flex items-center gap-1.5 shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>{detection.vehicleImageUrl?.startsWith('data:') ? 'CAM_ANPR (Photo Réelle)' : t('camLabel')}</span>
                  </div>
                </div>

                {/* Plate & Recognition Info */}
                <div className="flex flex-col justify-between space-y-3">
                  {/* Plate Badge Style Highway */}
                  <div className="bg-white rounded-lg p-2.5 shadow-md flex items-center justify-between border-2 border-slate-300">
                    <div className="flex items-center gap-3">
                      {detection.plateNumber.startsWith('GB') ? (
                        <div className="bg-emerald-700 text-amber-300 font-bold text-[10px] px-1.5 py-0.5 rounded flex flex-col items-center border border-emerald-600">
                          <span>★</span>
                          <span>GB</span>
                        </div>
                      ) : (/^(DK|ZG|KD|TH|KL)/.test(detection.plateNumber)) ? (
                        <div className="bg-blue-800 text-white font-bold text-[10px] px-1.5 py-0.5 rounded flex flex-col items-center">
                          <span>★</span>
                          <span>SN</span>
                        </div>
                      ) : (
                        <div className="bg-slate-800 text-amber-300 font-bold text-[10px] px-1.5 py-0.5 rounded flex flex-col items-center border border-slate-700">
                          <span>🌐</span>
                          <span>INT</span>
                        </div>
                      )}

                      {isEditingPlate ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editPlateValue}
                            onChange={(e) => setEditPlateValue(e.target.value.toUpperCase())}
                            className="font-mono text-xl font-black text-slate-900 border border-slate-400 px-2 py-0.5 rounded uppercase outline-none focus:border-emerald-600"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editPlateValue.trim()) {
                                setDetection(prev => prev ? { ...prev, plateNumber: editPlateValue.trim().toUpperCase() } : null);
                              }
                              setIsEditingPlate(false);
                            }}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
                          {detection.plateNumber}
                        </span>
                      )}
                    </div>

                    {!isEditingPlate && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPlateValue(detection.plateNumber);
                          setIsEditingPlate(true);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded transition-colors"
                        title="Corriger la plaque"
                      >
                        <span>✏️</span>
                        <span className="text-[10px] font-semibold">Modifier</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-800/60 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('classifiedCategory')}</span>
                      <span className="font-bold text-emerald-400">[{detection.categoryCode}] {tCategory(detection.categoryCode, detection.categoryLabel)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('ticketGenerated')}</span>
                      <span className="font-mono text-slate-200">{detection.ticketNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('calculatedTariff')}</span>
                      <span className="text-base font-bold text-white">{formatCurrency(detection.amountDue)} FCFA</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNextVehicle}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    {t('resetBtn')}
                  </button>
                  <button
                    onClick={() => {
                      setDetection(null);
                      setStep('WAITING');
                      setHikvisionLiveDetection(null);
                      setHikvisionPlateInput('');
                      setIsHikvisionPlateEdited(false);
                    }}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                    <span>{language === 'fr' ? '🔄 Reprendre / Relire' : '🔄 Retake / Rescan'}</span>
                  </button>
                </div>

                <button
                  id="btn-proceed-payment"
                  onClick={() => setStep('PAYMENT')}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <span>{t('proceedPaymentBtn')} ({formatCurrency(detection.amountDue)} FCFA)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SÉLECTION PAIEMENT */}
          {step === 'PAYMENT' && detection && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{t('tollPaymentTitle')}</h2>
                  <p className="text-xs text-slate-400">
                    {t('tablePlateHeader')} : <span className="font-mono text-white font-bold">{detection.plateNumber}</span> • {tCategory(detection.categoryCode, detection.categoryLabel)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">{t('amountDueLabel')}</div>
                  <div className="text-2xl font-black text-emerald-400">
                    {formatCurrency(detection.amountDue)} FCFA
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">
                  {t('paymentMethodLabel')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => { setPaymentMethod('ESPECES'); setAmountPaid(detection.amountDue); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'ESPECES'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span className="text-xs">{t('cashLabel')}</span>
                  </button>

                  <button
                    onClick={() => { setPaymentMethod('WAVE'); setAmountPaid(detection.amountDue); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'WAVE'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-sky-400" />
                    <span className="text-xs">Wave</span>
                  </button>

                  <button
                    onClick={() => { setPaymentMethod('ORANGE_MONEY'); setAmountPaid(detection.amountDue); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'ORANGE_MONEY'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-orange-400" />
                    <span className="text-xs">Orange M.</span>
                  </button>

                  <button
                    onClick={() => { setPaymentMethod('CARTE'); setAmountPaid(detection.amountDue); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'CARTE'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-xs">{t('cardLabel')}</span>
                  </button>

                  <button
                    onClick={() => { setPaymentMethod('RFID'); setAmountPaid(detection.amountDue); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'RFID'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Radio className="w-5 h-5" />
                    <span className="text-xs">{t('rfidLabel')}</span>
                  </button>
                </div>
              </div>

              {/* Mode-specific input panel */}
              {paymentMethod === 'ESPECES' && (
                <div className="bg-slate-800/60 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t('cashGivenLabel')}</label>
                      <input
                        id="input-cash-amount"
                        type="number"
                        step="100"
                        min={detection.amountDue}
                        value={amountPaid}
                        onChange={e => setAmountPaid(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-lg font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-700 flex flex-col justify-center">
                      <div className="text-xs text-slate-400">{t('changeReturnedLabel')}</div>
                      <div className={`text-2xl font-black ${changeReturned > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {formatCurrency(changeReturned)} FCFA
                      </div>
                    </div>
                  </div>

                  {/* Fast cash buttons */}
                  <div>
                    <span className="text-xs text-slate-400 block mb-2">{t('quickBillsLabel')}</span>
                    <div className="flex flex-wrap gap-2">
                      {[500, 1000, 2000, 5000, 10000].map(cashVal => (
                        <button
                          key={cashVal}
                          type="button"
                          onClick={() => setAmountPaid(cashVal)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-mono border border-slate-700"
                        >
                          +{formatCurrency(cashVal)} F
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAmountPaid(detection.amountDue)}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs rounded-lg font-mono border border-emerald-500/30 font-bold"
                      >
                        {t('exactAmountBtn')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(paymentMethod === 'WAVE' || paymentMethod === 'ORANGE_MONEY') && (
                <div className="bg-slate-800/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      {paymentMethod === 'WAVE'
                        ? (language === 'fr' ? 'Simulation Débit Wave Mobile Money' : 'Wave Mobile Money Debit Simulation')
                        : (language === 'fr' ? 'Simulation Débit Orange Money' : 'Orange Money Debit Simulation')}
                    </span>
                    <span className="text-xs text-slate-400">
                      {language === 'fr' ? 'Délai simulé : ~1,5s' : 'Simulated delay: ~1.5s'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      {paymentMethod === 'WAVE' ? t('phoneWaveLabel') : t('phoneOrangeLabel')}
                    </label>
                    <input
                      type="text"
                      value={mobilePhone}
                      onChange={e => setMobilePhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                    />
                  </div>
                  {mobileProcessing && (
                    <div className="flex items-center gap-2 text-xs text-sky-400 animate-pulse">
                      <div className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('processingMobile')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep('DETECTED')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  {t('backBtn')}
                </button>

                <button
                  id="btn-validate-payment"
                  onClick={handleProcessPayment}
                  disabled={loading || mobileProcessing}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t('validatePaymentBtn')}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: VALIDÉ & REÇU / BARRIÈRE OUVERTE */}
          {step === 'VALIDATED' && lastTransaction && (
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{t('paymentSuccessTitle')}</h2>
                    <p className="text-xs text-emerald-400 font-medium">{t('barrierOpenSubtitle')}</p>
                  </div>
                </div>

                {autoCloseCountdown !== null && (
                  <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs flex items-center gap-2 text-slate-300 font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('closingInCountdown')} {autoCloseCountdown}s</span>
                  </div>
                )}
              </div>

              {/* Transaction Summary Badge */}
              <div className="bg-slate-800/60 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">{t('tablePlateHeader')} :</span>
                  <span className="font-mono font-bold text-white text-sm">{lastTransaction.plateNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('tableTicketHeader')} :</span>
                  <span className="font-mono text-slate-200">{lastTransaction.ticketNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('tableMethodHeader')} :</span>
                  <span className="font-bold text-slate-200">{lastTransaction.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('amountDueLabel')} :</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatCurrency(lastTransaction.amountDue)} FCFA
                  </span>
                </div>
              </div>

              {/* Buttons: PDF Receipt Download & Next Vehicle */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  id="btn-download-receipt"
                  onClick={handleDownloadReceipt}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('printDownloadReceipt')}</span>
                </button>

                <button
                  id="btn-next-vehicle"
                  onClick={handleNextVehicle}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all"
                >
                  <span>{t('nextVehicleBtn')}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Hardware Visualizer (Barrier & Lane Simulation Proforma) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            {/* Lane Header with Proforma Selector */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {language === 'fr' ? 'Voie de Péage' : 'Toll Lane'} :
                </span>
                <select
                  value={selectedLane}
                  onChange={e => setSelectedLane(e.target.value as any)}
                  className="bg-slate-800 text-emerald-400 font-mono font-bold text-xs px-2.5 py-1 rounded-lg border border-slate-700"
                >
                  <option value="VOIE-01">VOIE-01 (Mixte)</option>
                  <option value="VOIE-02">VOIE-02 (VL / Taxi)</option>
                  <option value="VOIE-03">VOIE-03 (Poids Lourds)</option>
                  <option value="VOIE-04">VOIE-04 (Express E-Pass)</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>AREZKI BISSAU</span>
              </div>
            </div>

            {/* Compact Technical Equipment Bar (Proforma AREZKI) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between font-mono text-[11px] font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <span className="text-amber-400">⚡</span>
                    <span>Inverter 230V</span>
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>230V OK</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  {t('descInverter')}
                </p>
              </div>

              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between font-mono text-[11px] font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sky-400">🌐</span>
                    <span>Switch 16P PoE</span>
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Gbps PoE</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  {t('descSwitchPoE')}
                </p>
              </div>

              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between font-mono text-[11px] font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-400">📹</span>
                    <span>{language === 'fr' ? 'NVR 4 Voies REC' : '4-Lane NVR REC'}</span>
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>25 FPS</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  {t('descNvr')}
                </p>
              </div>
            </div>

            {/* Visual Highway Lane Scene with Real Vehicle & Induction Loops */}
            <div className="relative h-64 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-end p-4">
              {/* 4MP ANPR Camera status in top-left */}
              <div className="absolute top-3 left-3 bg-slate-900/95 border border-slate-700 rounded-lg px-2.5 py-1 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow">
                <span className={`w-2 h-2 rounded-full ${detection ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                <span className="font-bold">4MP ANPR CAM</span>
                <span className="text-slate-400 text-[9px]">| {language === 'fr' ? 'OCR Plaque HD' : 'HD Plate OCR'}</span>
              </div>

              {/* Traffic Light */}
              <div className="absolute top-3 right-3 bg-slate-900 border border-slate-700 rounded-lg p-1.5 flex flex-col gap-1.5 items-center shadow-lg">
                <div className={`w-3.5 h-3.5 rounded-full ${barrierOpen ? 'bg-slate-800 opacity-40' : 'bg-red-500 shadow-md shadow-red-500/80 animate-pulse'}`}></div>
                <div className={`w-3.5 h-3.5 rounded-full ${barrierOpen ? 'bg-emerald-400 shadow-md shadow-emerald-500/80 animate-pulse' : 'bg-slate-800 opacity-40'}`}></div>
              </div>

              {/* Lane Info display board */}
              <div className="absolute top-11 left-3 bg-black/90 border border-emerald-500/40 rounded px-2 py-0.5 text-emerald-400 font-mono text-[10px] shadow">
                {barrierOpen ? t('passageAuthorized') : t('stopToll')}
              </div>

              {/* Vehicle Rendering on the Asphalt (Taxi / Car / Truck) */}
              {detection && (
                <div
                  className="absolute bottom-10 z-20 flex flex-col items-center transition-all duration-1000 ease-in-out"
                  style={{
                    left: barrierOpen ? 'calc(50% + 50px)' : '14%',
                    opacity: barrierOpen && autoCloseCountdown !== null && autoCloseCountdown <= 2 ? 0.3 : 1
                  }}
                >
                  <div className="w-28 h-16 bg-slate-900 border-2 border-emerald-400 rounded-lg overflow-hidden shadow-2xl relative">
                    <img
                      src={detection.vehicleImageUrl}
                      alt={detection.categoryLabel}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-[9px] font-mono font-bold text-center text-emerald-300 py-0.5">
                      {detection.plateNumber}
                    </div>
                  </div>
                </div>
              )}

              {/* Barrier Motor Pillar & Arm */}
              <div className="relative flex items-end ml-auto mr-10">
                {/* Pillar */}
                <div className="w-7 h-20 bg-slate-800 border-2 border-slate-600 rounded-t flex flex-col items-center justify-center gap-1 z-10">
                  <div className={`w-2.5 h-2.5 rounded-full ${barrierOpen ? 'bg-emerald-400' : 'bg-red-500'}`}></div>
                </div>

                {/* Animated Barrier Boom Arm */}
                <div
                  className="h-3.5 bg-white border border-slate-400 rounded-r flex overflow-hidden z-20"
                  style={{
                    width: '180px',
                    transform: barrierOpen ? 'rotate(-75deg)' : 'rotate(0deg)',
                    transformOrigin: '0% 50%',
                    transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {/* Red/White Stripes */}
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full w-5 ${i % 2 === 0 ? 'bg-red-600' : 'bg-white'}`}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Asphalt Road Ground with Loop 1 (Amont) and Loop 2 (Aval) */}
              <div className="h-8 w-full bg-slate-800 border-t border-slate-700 flex items-center justify-between px-3 relative">
                {/* Loop 1 */}
                <div className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors flex items-center gap-1.5 ${
                  detection && !barrierOpen
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 animate-pulse'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}>
                  <span>BOUCLE 1 (AMONT)</span>
                  <span className="text-[8px] opacity-80 font-normal">[{language === 'fr' ? 'Présence' : 'Presence'}]</span>
                </div>

                {/* Center Road Dash */}
                <div className="w-8 h-1 bg-amber-400"></div>

                {/* Loop 2 */}
                <div className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors flex items-center gap-1.5 ${
                  barrierOpen
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 animate-pulse'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}>
                  <span>BOUCLE 2 (AVAL)</span>
                  <span className="text-[8px] opacity-80 font-normal">[{language === 'fr' ? 'Sécurité' : 'Safety'}]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: OUVERTURE MANUELLE BARRIÈRE */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title={t('manualOpenModalTitle')}
      >
        <form onSubmit={handleManualOpenBarrier} className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {t('manualOpenModalDesc')}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('motifRequiredLabel')}
            </label>
            <input
              id="input-manual-barrier-reason"
              type="text"
              required
              minLength={3}
              placeholder="Ex: Convoi officiel, Passage ambulance, Panne capteur..."
              value={manualReason}
              onChange={e => setManualReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {manualSuccessMsg && (
            <div className="text-xs text-emerald-400 font-medium">{manualSuccessMsg}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              {t('resetBtn')}
            </button>
            <button
              id="btn-confirm-manual-barrier"
              type="submit"
              disabled={loading || manualReason.trim().length < 3}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs disabled:opacity-50"
            >
              {t('confirmOpenBtn')}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ANNULATION DE TRANSACTION */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={t('cancelTxModalTitle')}
      >
        <form onSubmit={handleCancelTransaction} className="space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {t('cancelTxModalDesc')}
            </span>
          </div>

          {lastTransaction && (
            <div className="bg-slate-800/80 p-3 rounded-lg text-xs space-y-1">
              <div className="text-slate-400">{t('tableTicketHeader')} : <span className="text-white font-mono">{lastTransaction.ticketNumber}</span></div>
              <div className="text-slate-400">{t('tablePlateHeader')} : <span className="text-white font-bold">{lastTransaction.plateNumber}</span></div>
              <div className="text-slate-400">{t('amountDueLabel')} : <span className="text-white font-bold">{formatCurrency(lastTransaction.amountDue)} FCFA</span></div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('cancelReasonLabel')}
            </label>
            <input
              id="input-cancel-reason"
              type="text"
              required
              minLength={3}
              placeholder="Ex: Erreur de saisie catégorie, double débit, incident..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              {t('closeBtn')}
            </button>
            <button
              id="btn-confirm-cancel-tx"
              type="submit"
              disabled={loading || cancelReason.trim().length < 3}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs disabled:opacity-50"
            >
              {t('confirmCancelBtn')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
