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
  Check
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
  const [cameraMode, setCameraMode] = useState<'SIMULATION' | 'WEBCAM'>('SIMULATION');
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [liveDetection, setLiveDetection] = useState<VehicleDetectionResult | null>(null);
  const [webcamPlateInput, setWebcamPlateInput] = useState<string>('');
  const [isEditingPlate, setIsEditingPlate] = useState(false);
  const [editPlateValue, setEditPlateValue] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<any>(null);

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
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  // Synchronize OCR recognized plate into manual input state
  useEffect(() => {
    if (liveDetection?.isOcrLiveRead && liveDetection.plateNumberSuggestion) {
      setWebcamPlateInput(liveDetection.plateNumberSuggestion);
    }
  }, [liveDetection?.isOcrLiveRead, liveDetection?.plateNumberSuggestion]);

  const handleConfirmWebcamDetection = async () => {
    if (!liveDetection) return;
    setLoading(true);
    try {
      const finalPlate = (liveDetection.isOcrLiveRead ? liveDetection.plateNumberSuggestion : webcamPlateInput) ||
        webcamPlateInput ||
        liveDetection.plateNumberSuggestion ||
        liveDetection.fallbackPlate ||
        'GB-4512-AZ';

      const result = await api.detectVehicle(selectedLane, finalPlate.trim().toUpperCase(), liveDetection.categoryCode);
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
              {/* Mode Switcher: Demo Categories vs Live AI Camera (Webcam) */}
              <div className="flex items-center justify-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 max-w-sm mx-auto">
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
                          <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                            <span>✅ PLAQUE LUE :</span>
                            <span className="text-white px-1.5 rounded bg-emerald-500/30 border border-emerald-400/50">{liveDetection.plateNumberSuggestion}</span>
                          </span>
                        ) : (
                          <span className="text-amber-300 animate-pulse text-[9px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                            <span>Centrer la plaque dans le viseur</span>
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
                              <span>Tarif : {formatCurrency(liveDetection.tariff)} FCFA</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-slate-300 font-mono font-bold">Plaque :</span>
                              <input
                                type="text"
                                id="input-webcam-plate"
                                value={webcamPlateInput}
                                onChange={(e) => setWebcamPlateInput(e.target.value.toUpperCase())}
                                placeholder={liveDetection.plateNumberSuggestion || liveDetection.fallbackPlate || 'Ex: AB-093-FB'}
                                className={`w-32 px-2 py-0.5 bg-slate-950 border font-mono font-bold text-xs rounded outline-none transition-colors ${
                                  liveDetection.isOcrLiveRead
                                    ? 'border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                                    : 'border-slate-700 text-white focus:border-amber-400'
                                }`}
                              />
                              {liveDetection.isOcrLiveRead ? (
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <span>✨ LAPI</span>
                                  {liveDetection.ocrCountryLabel && (
                                    <span className="text-[9px] font-normal">{liveDetection.ocrCountryLabel}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-400 flex items-center gap-1 font-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                                  <span>(Lecture OCR en cours...)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          id="btn-confirm-webcam-vehicle"
                          onClick={handleConfirmWebcamDetection}
                          className="w-full sm:w-auto px-4 py-2 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/30 font-black"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>
                            Valider {webcamPlateInput || liveDetection.plateNumberSuggestion || 'Véhicule'}
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
                        <div className="text-[11px] font-bold text-sky-300">Cat 2 : Voiture/Pickup</div>
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
                        <div className="text-[11px] font-bold text-indigo-300">Cat 3 : Canter/Bus</div>
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
                        <div className="text-[11px] font-bold text-purple-300">Cat 4 : Camion 7-20t</div>
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
                        <div className="text-[11px] font-bold text-rose-300">Cat 5 : Semi &gt;20t</div>
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
                {/* Vehicle Simulated Image */}
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video flex items-center justify-center">
                  <img
                    src={detection.vehicleImageUrl}
                    alt={detection.categoryLabel}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] text-slate-300">
                    {t('camLabel')}
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
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleNextVehicle}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  {t('resetBtn')}
                </button>

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
                      Simulation Débit {paymentMethod === 'WAVE' ? 'Wave Mobile Money' : 'Orange Money'}
                    </span>
                    <span className="text-xs text-slate-400">Délai simulé : ~1,5s</span>
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
                    <span>NVR 4 Voies REC</span>
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

            {/* Equipment Diagnostics Table (Proforma Match with Role Descriptions) */}
            <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>{t('laneEquipmentsState')}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {language === 'fr' ? 'Proforma AREZKI 100% Opérationnel' : 'AREZKI Proforma 100% Operational'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* 1. Caméra 4MP ANPR */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Caméra 4MP ANPR :</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {t('eqFunctional')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {t('descAnprCamera')}
                  </p>
                </div>

                {/* 2. Boucle 1 (Amont) */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Boucle 1 (Amont) :</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                      detection && !barrierOpen
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {detection && !barrierOpen ? t('eqActive') : t('eqStandby')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {t('descLoop1')}
                  </p>
                </div>

                {/* 3. Distributeur & Scanner 2D */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Distributeur & Scanner :</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {t('eqPaperOk')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {t('descDispenserScanner')}
                  </p>
                </div>

                {/* 4. Barrière Haute Vitesse & Feu */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Barrière Haute Vitesse :</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                      barrierOpen
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {barrierOpen ? t('eqRaised') : t('eqLowered')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {t('descBarrier')}
                  </p>
                </div>

                {/* 5. Boucle 2 (Aval) */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Boucle 2 (Aval) :</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                      barrierOpen
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {barrierOpen ? t('eqTransit') : t('eqStandby')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {t('descLoop2')}
                  </p>
                </div>

                {/* 6. Imprimante Caisse & TPE */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{language === 'fr' ? 'Imprimante Caisse & TPE :' : 'POS Terminal & Printer :'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {t('eqFunctional')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {t('descPosPrinter')}
                  </p>
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
