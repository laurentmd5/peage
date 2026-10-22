import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.ts';
import {
  Sliders,
  CheckCircle,
  Car,
  ShieldAlert,
  Wifi,
  BatteryCharging,
  Zap,
  ZapOff,
  Server,
  HardDrive,
  Video,
  Activity,
  Play,
  Square,
  RotateCcw,
  QrCode,
  Ticket,
  ArrowRight,
  AlertTriangle,
  Cpu,
  Terminal,
  Layers,
  Check,
  Radio,
  Eye,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useTranslation } from '../../services/i18n.tsx';
import { VehicleDetection } from '../../types.ts';

interface LaneState {
  id: string;
  nameKey: 'lane1Title' | 'lane2Title' | 'lane3Title' | 'lane4Title';
  typeFr: string;
  typeEn: string;
  loop1Active: boolean;
  loop2Active: boolean;
  barrierState: 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING';
  barrierAngle: number;
  detection: VehicleDetection | null;
  ticketDispensed: boolean;
  ticketScanned: boolean;
  status: 'IDLE' | 'DETECTED' | 'TICKET_PRINTED' | 'PAID' | 'CROSSING';
  totalPassages: number;
}

interface TelemetryLog {
  id: string;
  time: string;
  laneId: string;
  module: 'LOOP' | 'ANPR' | 'DISPENSER' | 'SCANNER' | 'BARRIER' | 'UPS' | 'SWITCH' | 'NVR';
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
}

export const SimulateurConsole: React.FC = () => {
  const { t, language, tCategory } = useTranslation();
  const isEn = language === 'en';

  // Active Selected Lane for Detailed Control
  const [activeLaneId, setActiveLaneId] = useState<string>('VOIE-01');

  // 4 Lanes aligned with Proforma (4 Barrières, 8 Boucles, 4 Bornes, 4 Caméras ANPR, 4 Postes)
  const [lanes, setLanes] = useState<Record<string, LaneState>>({
    'VOIE-01': {
      id: 'VOIE-01',
      nameKey: 'lane1Title',
      typeFr: 'VL / Véhicules Légers',
      typeEn: 'Light Vehicles (Cars, Pickups)',
      loop1Active: false,
      loop2Active: false,
      barrierState: 'CLOSED',
      barrierAngle: 0,
      detection: null,
      ticketDispensed: false,
      ticketScanned: false,
      status: 'IDLE',
      totalPassages: 14
    },
    'VOIE-02': {
      id: 'VOIE-02',
      nameKey: 'lane2Title',
      typeFr: 'Mixte (VL, Taxis, VTC)',
      typeEn: 'Mixed (Cars, Taxis, Rideshare)',
      loop1Active: false,
      loop2Active: false,
      barrierState: 'CLOSED',
      barrierAngle: 0,
      detection: null,
      ticketDispensed: false,
      ticketScanned: false,
      status: 'IDLE',
      totalPassages: 9
    },
    'VOIE-03': {
      id: 'VOIE-03',
      nameKey: 'lane3Title',
      typeFr: 'Poids Lourds, Bus & Convois',
      typeEn: 'Heavy Goods, Buses & Trucks',
      loop1Active: false,
      loop2Active: false,
      barrierState: 'CLOSED',
      barrierAngle: 0,
      detection: null,
      ticketDispensed: false,
      ticketScanned: false,
      status: 'IDLE',
      totalPassages: 6
    },
    'VOIE-04': {
      id: 'VOIE-04',
      nameKey: 'lane4Title',
      typeFr: 'Voie Rapide DSRC 5.8 GHz & Abonnés',
      typeEn: 'Express DSRC 5.8 GHz & Tag Pass',
      loop1Active: false,
      loop2Active: false,
      barrierState: 'CLOSED',
      barrierAngle: 0,
      detection: null,
      ticketDispensed: false,
      ticketScanned: false,
      status: 'IDLE',
      totalPassages: 18
    }
  });

  // Demo Plate & Category for manual trigger
  const [selectedPlate, setSelectedPlate] = useState('DK-2345-AF');
  const [selectedCategory, setSelectedCategory] = useState('VL');

  // Rack Server & Infrastructure (Proforma Items)
  const [upsMainsActive, setUpsMainsActive] = useState<boolean>(true);
  const [upsBatteryLevel, setUpsBatteryLevel] = useState<number>(98);
  const [switchPorts] = useState([
    { port: 1, name: 'CAM_ANPR_01', poe: true, active: true },
    { port: 2, name: 'CAM_ANPR_02', poe: true, active: true },
    { port: 3, name: 'CAM_ANPR_03', poe: true, active: true },
    { port: 4, name: 'CAM_ANPR_04', poe: true, active: true },
    { port: 5, name: 'BORNE_TICKET_01', poe: false, active: true },
    { port: 6, name: 'BORNE_TICKET_02', poe: false, active: true },
    { port: 7, name: 'BORNE_TICKET_03', poe: false, active: true },
    { port: 8, name: 'BORNE_TICKET_04', poe: false, active: true },
    { port: 9, name: 'POS_TACTILE_01', poe: false, active: true },
    { port: 10, name: 'POS_TACTILE_02', poe: false, active: true },
    { port: 11, name: 'POS_TACTILE_03', poe: false, active: true },
    { port: 12, name: 'POS_TACTILE_04', poe: false, active: true },
    { port: 13, name: 'NVR_STORAGE_4CH', poe: false, active: true },
    { port: 14, name: 'GATEWAY_TPE_MOBILE', poe: false, active: true },
    { port: 15, name: 'UPS_ONDELEUR_SNMP', poe: false, active: true },
    { port: 16, name: 'SERVEUR_CENTRAL_DB', poe: false, active: true }
  ]);

  // Traffic Generator (Auto Demo)
  const [isAutoTraffic, setIsAutoTraffic] = useState<boolean>(false);
  const [trafficCadence, setTrafficCadence] = useState<'NORMAL' | 'FAST'>('NORMAL');

  // Telemetry Log Feed
  const [logs, setLogs] = useState<TelemetryLog[]>([
    {
      id: 'log-1',
      time: '12:00:01',
      laneId: 'CENTRAL',
      module: 'SWITCH',
      message: isEn
        ? 'Gigabit Network Switch: 16/16 ports link UP (Full Duplex 1000 Mbps)'
        : 'Switch Réseau Gigabit : 16/16 ports link UP (Full Duplex 1000 Mbps)',
      type: 'info'
    },
    {
      id: 'log-2',
      time: '12:00:02',
      laneId: 'CENTRAL',
      module: 'UPS',
      message: isEn
        ? 'Professional UPS Inverter Online: 230V AC Nominal Input • Battery 98%'
        : 'Onduleur UPS Professionnel en ligne : Entrée 230V AC nominal • Batterie 98%',
      type: 'success'
    },
    {
      id: 'log-3',
      time: '12:00:03',
      laneId: 'CENTRAL',
      module: 'NVR',
      message: isEn
        ? '4-Channel NVR: Continuous recording active across 4 streams 4MP @ 25 FPS'
        : 'NVR 4 canaux : Enregistrement continu actif sur 4 flux 4MP @ 25 FPS',
      type: 'info'
    }
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (
    laneId: string,
    module: TelemetryLog['module'],
    messageFr: string,
    messageEn: string,
    type: TelemetryLog['type'] = 'info'
  ) => {
    const time = new Date().toLocaleTimeString(isEn ? 'en-US' : 'fr-FR');
    const newLog: TelemetryLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      time,
      laneId,
      module,
      message: isEn ? messageEn : messageFr,
      type
    };
    setLogs(prev => [newLog, ...prev.slice(0, 49)]);
  };

  // Predefined demo plates (Senegal DK and Guinea-Bissau GB for AREZKI BISSAU)
  const demoPlates = [
    // Senegal Dakar
    { plate: 'DK-2345-AF', cat: 'VL', country: 'SN', flag: isEn ? '🇸🇳 Senegal' : '🇸🇳 Sénégal' },
    { plate: 'DK-1234-AA', cat: 'VL', country: 'SN', flag: isEn ? '🇸🇳 Senegal' : '🇸🇳 Sénégal' },
    { plate: 'DK-9012-CC', cat: 'TAXI', country: 'SN', flag: isEn ? '🇸🇳 Senegal' : '🇸🇳 Sénégal' },
    { plate: 'DK-5678-BB', cat: 'BUS', country: 'SN', flag: isEn ? '🇸🇳 Senegal' : '🇸🇳 Sénégal' },
    { plate: 'DK-3456-DD', cat: 'PL', country: 'SN', flag: isEn ? '🇸🇳 Senegal' : '🇸🇳 Sénégal' },
    { plate: 'DK-7890-EE', cat: 'EXEMPT', country: 'SN', flag: isEn ? '🇸🇳 Senegal' : '🇸🇳 Sénégal' },
    // Guinea-Bissau (AREZKI BISSAU)
    { plate: 'GB-2345-AF', cat: 'VL', country: 'GW', flag: '🇬🇼 Guinea-Bissau' },
    { plate: 'GB-8765-BZ', cat: 'PL', country: 'GW', flag: '🇬🇼 Guinea-Bissau' },
    { plate: 'GB-4512-AZ', cat: 'UTIL', country: 'GW', flag: '🇬🇼 Guinea-Bissau' },
    { plate: 'GB-9021-BB', cat: 'MINIBUS', country: 'GW', flag: '🇬🇼 Guinea-Bissau' }
  ];

  // STEP 1: Véhicule arrive sur la Boucle 1 (Amont) & Capture ANPR 4MP
  const handleLoop1Arrival = async (laneId: string = activeLaneId, plateOverride?: string, catOverride?: string) => {
    const plate = plateOverride || selectedPlate;
    const cat = catOverride || selectedCategory;

    addLog(
      laneId,
      'LOOP',
      `Boucle Amont (Loop 1) excitée : Détection présence masse métallique`,
      `Entry Loop (Loop 1) triggered: Metallic vehicle mass detected`,
      'info'
    );

    // Mettre à jour la voie en détection
    setLanes(prev => ({
      ...prev,
      [laneId]: {
        ...prev[laneId],
        loop1Active: true,
        status: 'DETECTED'
      }
    }));

    try {
      addLog(
        laneId,
        'ANPR',
        `Caméra ANPR 4MP : Trigger capture optique & calcul OCR`,
        `4 MP ANPR Camera: Optical capture triggered & OCR processing`,
        'info'
      );
      const res = await api.detectVehicle(laneId, plate, cat);

      addLog(
        laneId,
        'ANPR',
        `Plaque reconnue : ${res.plateNumber} (${res.categoryLabel}) • Confiance OCR : ${res.confidence}%`,
        `Plate recognized: ${res.plateNumber} (${tCategory(res.categoryCode, res.categoryLabel)}) • OCR Confidence: ${res.confidence}%`,
        'success'
      );

      setLanes(prev => ({
        ...prev,
        [laneId]: {
          ...prev[laneId],
          detection: res,
          ticketDispensed: false,
          ticketScanned: false,
          status: 'DETECTED'
        }
      }));

      // Si c'est la voie 4 (Express / Télépéage RFID), paiement & levée automatique immédiate
      if (laneId === 'VOIE-04') {
        setTimeout(() => handleAutomaticRfidPass(laneId, res), 1000);
      }
    } catch (err: any) {
      addLog(
        laneId,
        'ANPR',
        `Erreur traitement ANPR : ${err.message}`,
        `ANPR processing error: ${err.message}`,
        'alert'
      );
    }
  };

  // STEP 2: Borne Automatique délivre le Ticket
  const handleDispenseTicket = (laneId: string = activeLaneId) => {
    const lane = lanes[laneId];
    if (!lane.detection) return;

    addLog(
      laneId,
      'DISPENSER',
      `Borne Automatique : Bouton poussoir pressé -> Impression ticket thermique #${lane.detection.ticketNumber} avec QR Code`,
      `Automatic Dispenser: Push button pressed -> Thermal ticket printed #${lane.detection.ticketNumber} with QR Code`,
      'success'
    );

    setLanes(prev => ({
      ...prev,
      [laneId]: {
        ...prev[laneId],
        ticketDispensed: true,
        status: 'TICKET_PRINTED'
      }
    }));
  };

  // STEP 3: Lecteur QR 2D scanne le ticket & encaisse -> Ouverture Barrière
  const handleScanTicketAndPay = async (laneId: string = activeLaneId) => {
    const lane = lanes[laneId];
    if (!lane.detection) return;

    addLog(
      laneId,
      'SCANNER',
      `Lecteur 2D de voie : Scan du ticket #${lane.detection.ticketNumber} • Transmission automate`,
      `2D Lane Scanner: Scanned ticket #${lane.detection.ticketNumber} • Transmitted to PLC`,
      'info'
    );

    try {
      // Process payment through backend API
      const tx = await api.processPayment({
        laneId,
        plateNumber: lane.detection.plateNumber,
        categoryCode: lane.detection.categoryCode,
        categoryLabel: lane.detection.categoryLabel,
        amountDue: lane.detection.amountDue,
        amountPaid: lane.detection.amountDue,
        paymentMethod: laneId === 'VOIE-02' ? 'WAVE' : 'ESPECES',
        cashierId: 'sim-auto',
        cashierName: isEn ? 'Lane Automated POS' : 'Automate de Voie',
        ticketNumber: lane.detection.ticketNumber,
        qrCodeData: lane.detection.qrCodeData
      });

      addLog(
        laneId,
        'BARRIER',
        `Paiement validé (${tx.amountDue} FCFA via ${tx.paymentMethod}) -> Ordre ouverture barrière levante`,
        `Payment confirmed (${tx.amountDue} FCFA via ${tx.paymentMethod}) -> Barrier gate OPEN command issued`,
        'success'
      );

      // Ouvrir la barrière avec animation
      setLanes(prev => ({
        ...prev,
        [laneId]: {
          ...prev[laneId],
          ticketScanned: true,
          barrierState: 'OPEN',
          barrierAngle: 85,
          status: 'PAID'
        }
      }));
    } catch (err: any) {
      addLog(
        laneId,
        'BARRIER',
        `Erreur validation paiement : ${err.message}`,
        `Payment validation error: ${err.message}`,
        'alert'
      );
    }
  };

  // Passage automatique Télépéage RFID (Voie 04)
  const handleAutomaticRfidPass = async (laneId: string, detection: VehicleDetection) => {
    addLog(
      laneId,
      'SCANNER',
      `Antenne RFID DSRC 5.8 GHz : Badge usager détecté • Débit compte prépayé`,
      `5.8 GHz DSRC RFID Antenna: Vehicle e-tag detected • Prepaid account debited`,
      'info'
    );

    try {
      const tx = await api.processPayment({
        laneId,
        plateNumber: detection.plateNumber,
        categoryCode: detection.categoryCode,
        categoryLabel: detection.categoryLabel,
        amountDue: detection.amountDue,
        amountPaid: detection.amountDue,
        paymentMethod: 'RFID',
        cashierId: 'antenne-rfid',
        cashierName: isEn ? 'DSRC E-Pass Antenna' : 'Pass Télépéage DSRC',
        ticketNumber: detection.ticketNumber,
        qrCodeData: detection.qrCodeData
      });

      addLog(
        laneId,
        'BARRIER',
        `Badge RFID validé (${tx.amountDue} FCFA) -> Levée automatique prioritaire`,
        `RFID tag approved (${tx.amountDue} FCFA) -> Express priority barrier opening`,
        'success'
      );

      setLanes(prev => ({
        ...prev,
        [laneId]: {
          ...prev[laneId],
          ticketDispensed: true,
          ticketScanned: true,
          barrierState: 'OPEN',
          barrierAngle: 85,
          status: 'PAID'
        }
      }));

      // Simulation du franchissement rapide
      setTimeout(() => handleLoop2Crossing(laneId), 1500);
    } catch (err: any) {
      addLog(
        laneId,
        'SCANNER',
        `Erreur RFID : ${err.message}`,
        `RFID Error: ${err.message}`,
        'alert'
      );
    }
  };

  // STEP 4: Boucle 2 (Aval) : Véhicule franchit et la barrière se referme automatiquement
  const handleLoop2Crossing = (laneId: string = activeLaneId) => {
    addLog(
      laneId,
      'LOOP',
      `Boucle Aval (Loop 2) : Véhicule en cours de franchissement • Sécurité anti-écrasement active`,
      `Exit Loop (Loop 2): Vehicle currently crossing • Anti-tailgating & safety active`,
      'warning'
    );

    setLanes(prev => ({
      ...prev,
      [laneId]: {
        ...prev[laneId],
        loop1Active: false,
        loop2Active: true,
        status: 'CROSSING'
      }
    }));

    // Après dégagement complet de la boucle 2, refermeture sécurisée
    setTimeout(() => {
      addLog(
        laneId,
        'LOOP',
        `Boucle Aval libérée : Véhicule dégagé -> Commande automatique fermeture barrière`,
        `Exit Loop cleared: Vehicle fully passed -> Automatic barrier closing command issued`,
        'info'
      );
      addLog(
        laneId,
        'BARRIER',
        `Barrière levante refermée • Voie réarmée pour le véhicule suivant`,
        `Barrier gate closed • Lane reset and armed for next vehicle`,
        'success'
      );

      setLanes(prev => ({
        ...prev,
        [laneId]: {
          ...prev[laneId],
          loop2Active: false,
          barrierState: 'CLOSED',
          barrierAngle: 0,
          detection: null,
          ticketDispensed: false,
          ticketScanned: false,
          status: 'IDLE',
          totalPassages: prev[laneId].totalPassages + 1
        }
      }));
    }, 2000);
  };

  // Simuler coupure de courant / Reprise Onduleur UPS (650 000 FCFA)
  const toggleUpsPower = () => {
    if (upsMainsActive) {
      setUpsMainsActive(false);
      addLog(
        'CENTRAL',
        'UPS',
        '⚡ ALERTE COUPURE SECTEUR 230V ! Bascule immédiate sur batterie (0 ms) • Onduleur UPS actif',
        '⚡ 230V MAINS OUTAGE ALERT! Instant switch to battery (0 ms) • UPS inverter active',
        'alert'
      );
    } else {
      setUpsMainsActive(true);
      addLog(
        'CENTRAL',
        'UPS',
        'Rétablissement du secteur 230V nominal • Recharge batterie en cours',
        '230V Mains power restored • Recharging battery',
        'success'
      );
    }
  };

  // Auto Traffic Demo Mode Loop
  useEffect(() => {
    if (!isAutoTraffic) return;

    const intervalMs = trafficCadence === 'FAST' ? 3500 : 6000;
    const laneKeys = Object.keys(lanes);

    const timer = setInterval(() => {
      // Pick random idle lane
      const availableLanes = laneKeys.filter(k => lanes[k].status === 'IDLE');
      if (availableLanes.length === 0) return;

      const randomLaneId = availableLanes[Math.floor(Math.random() * availableLanes.length)];
      const randomDemo = demoPlates[Math.floor(Math.random() * demoPlates.length)];

      // Launch full cycle automatically on this lane
      (async () => {
        await handleLoop1Arrival(randomLaneId, randomDemo.plate, randomDemo.cat);

        if (randomLaneId !== 'VOIE-04') {
          setTimeout(() => {
            handleDispenseTicket(randomLaneId);
            setTimeout(() => {
              handleScanTicketAndPay(randomLaneId);
              setTimeout(() => {
                handleLoop2Crossing(randomLaneId);
              }, 2000);
            }, 1200);
          }, 1200);
        }
      })();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isAutoTraffic, trafficCadence, lanes]);

  const currentLane = lanes[activeLaneId];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner: Proforma Client & SCADA Title */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PROFORMA #PRO-20260926-313
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                CLIENT : AREZKI BISSAU
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {t('proformaBudget')}
              </span>
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
              <Sliders className="w-6 h-6 text-emerald-400" />
              <span>{t('simTitle')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('simSubtitle')}
            </p>
          </div>

          {/* Quick Hardware Status Indicators */}
          <div className="flex flex-wrap items-center gap-2">
            {/* UPS Status Indicator */}
            <button
              onClick={toggleUpsPower}
              title={isEn ? 'Click to simulate a 230V mains power cut' : 'Cliquez pour simuler une coupure de courant 230V'}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                upsMainsActive
                  ? 'bg-slate-800/80 border-emerald-500/30 text-emerald-300 hover:bg-slate-700'
                  : 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
              }`}
            >
              {upsMainsActive ? (
                <Zap className="w-4 h-4 text-emerald-400" />
              ) : (
                <ZapOff className="w-4 h-4 text-red-400" />
              )}
              <span>{upsMainsActive ? t('upsActiveMains') : t('upsActiveBattery')}</span>
            </button>

            {/* Auto Traffic Presentation Toggle */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                onClick={() => setIsAutoTraffic(!isAutoTraffic)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  isAutoTraffic
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                }`}
              >
                {isAutoTraffic ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isAutoTraffic ? t('stopTrafficBtn') : t('startTrafficBtn')}</span>
              </button>
              {isAutoTraffic && (
                <button
                  onClick={() => setTrafficCadence(c => (c === 'NORMAL' ? 'FAST' : 'NORMAL'))}
                  className="px-2 py-1 text-[11px] text-slate-300 hover:text-white font-mono"
                  title={isEn ? 'Toggle traffic speed' : 'Changer la cadence'}
                >
                  {trafficCadence === 'NORMAL' ? '1x' : '2x ⚡'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: 4 LANES OVERVIEW (MATRICE DES 4 VOIES DE LA PROFORMA) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>{t('fourLanesMatrixTitle')}</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {t('fourLanesMatrixSubtitle')}
          </span>
        </div>

        {/* 4 Lanes Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(lanes).map(lane => {
            const isSelected = lane.id === activeLaneId;
            const isBarrierOpen = lane.barrierState === 'OPEN';
            const isBusy = lane.status !== 'IDLE';

            return (
              <div
                key={lane.id}
                onClick={() => setActiveLaneId(lane.id)}
                className={`cursor-pointer rounded-2xl p-4 border transition-all duration-300 relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* Active Indicator Bar */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-sm text-white">{lane.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isBarrierOpen
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isBusy
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isBarrierOpen ? t('barrierHighBadge') : isBusy ? t('laneOccupiedBadge') : t('laneFreeBadge')}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-300">{t(lane.nameKey)}</div>
                <div className="text-[11px] text-slate-400 mb-3">{isEn ? lane.typeEn : lane.typeFr}</div>

                {/* Micro Hardware Indicators */}
                <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-mono py-2 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div title={isEn ? 'Loop 1 Entry' : 'Boucle 1 Amont'}>
                    <div className="text-slate-500 text-[9px]">L1</div>
                    <div className={`font-bold ${lane.loop1Active ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {lane.loop1Active ? 'ACT' : 'OFF'}
                    </div>
                  </div>
                  <div title={isEn ? '4MP ANPR Camera' : 'Caméra ANPR 4MP'}>
                    <div className="text-slate-500 text-[9px]">ANPR</div>
                    <div className={`font-bold ${lane.detection ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {lane.detection ? 'OCR' : 'RDY'}
                    </div>
                  </div>
                  <div title={isEn ? 'Ticket Dispenser' : 'Borne Ticket'}>
                    <div className="text-slate-500 text-[9px]">TKT</div>
                    <div className={`font-bold ${lane.ticketDispensed ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {lane.ticketDispensed ? 'PRT' : 'OFF'}
                    </div>
                  </div>
                  <div title={isEn ? 'Loop 2 Exit' : 'Boucle 2 Aval'}>
                    <div className="text-slate-500 text-[9px]">L2</div>
                    <div className={`font-bold ${lane.loop2Active ? 'text-amber-400' : 'text-slate-600'}`}>
                      {lane.loop2Active ? 'ACT' : 'OFF'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{t('passagesCountLabel')} <b className="text-white font-mono">{lane.totalPassages}</b></span>
                  {lane.detection && (
                    <span className="text-emerald-400 font-mono font-bold truncate max-w-[100px]">
                      {lane.detection.plateNumber}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: HARDWARE-IN-THE-LOOP INTERACTIVE SYNOPTIC FOR ACTIVE LANE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Physical Lane Hardware Synoptic (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                🛣️
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{t(currentLane.nameKey)}</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                    {currentLane.id}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {t('laneHardwareDesc')}
                </p>
              </div>
            </div>

            {/* Quick Step Indicator */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className={`px-2 py-1 rounded ${currentLane.loop1Active ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                {t('step1Loop')}
              </span>
              <span className="text-slate-600">→</span>
              <span className={`px-2 py-1 rounded ${currentLane.detection ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                {t('step2Anpr')}
              </span>
              <span className="text-slate-600">→</span>
              <span className={`px-2 py-1 rounded ${currentLane.ticketDispensed ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                {t('step3Dispenser')}
              </span>
              <span className="text-slate-600">→</span>
              <span className={`px-2 py-1 rounded ${currentLane.barrierState === 'OPEN' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                {t('step4Barrier')}
              </span>
              <span className="text-slate-600">→</span>
              <span className={`px-2 py-1 rounded ${currentLane.loop2Active ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                {t('step5Loop')}
              </span>
            </div>
          </div>

          {/* Graphical Lane Visualizer with Physical Equipment */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-hidden">
            {/* Road Lane Graphics */}
            <div className="h-44 relative flex items-center justify-between border-y-2 border-dashed border-slate-700 px-6">
              {/* ROAD MARKINGS */}
              <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-between pointer-events-none px-12">
                <div className="w-12 h-1 bg-amber-400/80"></div>
                <div className="w-12 h-1 bg-amber-400/80"></div>
                <div className="w-12 h-1 bg-amber-400/80"></div>
                <div className="w-12 h-1 bg-amber-400/80"></div>
              </div>

              {/* 1. ENTRY LOOP (BOUCLE AMONT) */}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${
                    currentLane.loop1Active
                      ? 'border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/30'
                      : 'border-slate-700 bg-slate-900/80'
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{t('loop1Label')}</span>
                  <span className="text-[9px] text-slate-500">{t('loop1Sub')}</span>
                  <span
                    className={`mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      currentLane.loop1Active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {currentLane.loop1Active ? t('loopDetectionBadge') : t('loopIdleBadge')}
                  </span>
                </div>
              </div>

              {/* VEHICLE SIMULATION ANIMATION */}
              {currentLane.detection && (
                <div className="relative z-20 flex flex-col items-center transition-all duration-700">
                  <div className="w-32 h-20 bg-slate-900 border-2 border-emerald-400 rounded-xl overflow-hidden shadow-2xl relative">
                    <img
                      src={currentLane.detection.vehicleImageUrl}
                      alt="Vehicle"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-[10px] font-mono font-bold text-center text-emerald-300 py-0.5">
                      {currentLane.detection.plateNumber}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300 mt-1">
                    [{currentLane.detection.categoryCode}] {tCategory(currentLane.detection.categoryCode, currentLane.detection.categoryLabel)}
                  </span>
                </div>
              )}

              {/* 2. AUTOMATIC TICKET DISPENSER (BORNE DE VOIE) */}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-20 h-28 rounded-xl border flex flex-col items-center justify-between p-2 shadow-lg transition-all ${
                    currentLane.ticketDispensed
                      ? 'bg-slate-800 border-emerald-500 shadow-emerald-500/20'
                      : 'bg-slate-900 border-slate-700'
                  }`}
                >
                  <div className="w-full text-center text-[9px] font-mono bg-slate-950 py-0.5 rounded text-amber-300 font-bold">
                    {t('borneTicketLabel')}
                  </div>
                  {/* Push Button on the Dispenser */}
                  <div className="w-5 h-5 rounded-full bg-emerald-500 shadow-md flex items-center justify-center text-[9px] text-slate-950 font-black animate-pulse">
                    ●
                  </div>
                  <span className="text-[8px] text-center text-slate-400">
                    {currentLane.ticketDispensed ? t('ticketDispensedBadge') : t('pressBtnLabel')}
                  </span>
                </div>
              </div>

              {/* 3. PHYSICAL MOTORIZED BARRIER (BARRIÈRE LEVANTE) */}
              <div className="relative z-10 flex flex-col items-center">
                {/* Barrier Base Cabinet */}
                <div className="w-12 h-20 bg-amber-500 rounded-lg border-2 border-amber-600 shadow-xl flex flex-col items-center justify-between p-1">
                  <span className="text-[8px] font-black text-slate-950">{t('barrierCabinetLabel')}</span>
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${
                      currentLane.barrierState === 'OPEN' ? 'bg-emerald-400 shadow-lg shadow-emerald-400' : 'bg-red-600'
                    }`}
                  />
                  <span className="text-[7px] text-slate-900 font-mono font-bold">NETSYS</span>
                </div>

                {/* Motorized Boom Arm with Stripes */}
                <div
                  className="absolute bottom-2 left-6 h-3 bg-white border border-slate-800 rounded origin-left transition-all duration-700 flex overflow-hidden shadow-lg"
                  style={{
                    width: '120px',
                    transform: `rotate(-${currentLane.barrierAngle}deg)`
                  }}
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full w-4 ${i % 2 === 0 ? 'bg-red-600' : 'bg-white'}`}
                    />
                  ))}
                </div>
              </div>

              {/* 4. EXIT LOOP (BOUCLE AVAL / SÉCURITÉ) */}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${
                    currentLane.loop2Active
                      ? 'border-amber-400 bg-amber-500/20 shadow-lg shadow-amber-500/30'
                      : 'border-slate-700 bg-slate-900/80'
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{t('loop2Label')}</span>
                  <span className="text-[9px] text-slate-500">{t('loop2Sub')}</span>
                  <span
                    className={`mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      currentLane.loop2Active ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {currentLane.loop2Active ? t('loopCrossingBadge') : t('loopIdleBadge')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Hardware Execution Controls for Active Lane */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              {t('manualControlsTitle')} ({currentLane.id})
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Step 1 Button */}
              <button
                id="btn-sim-step1"
                onClick={() => handleLoop1Arrival()}
                className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left flex flex-col justify-between transition-all group"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400">{t('manualStep1Title')}</span>
                  <Car className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-[11px] text-slate-400">{t('manualStep1Desc')}</span>
              </button>

              {/* Step 2 Button */}
              <button
                id="btn-sim-step2"
                onClick={() => handleDispenseTicket()}
                disabled={!currentLane.detection}
                className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left flex flex-col justify-between transition-all group disabled:opacity-40"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400">{t('manualStep2Title')}</span>
                  <Ticket className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-[11px] text-slate-400">{t('manualStep2Desc')}</span>
              </button>

              {/* Step 3 Button */}
              <button
                id="btn-sim-step3"
                onClick={() => handleScanTicketAndPay()}
                disabled={!currentLane.detection || currentLane.barrierState === 'OPEN'}
                className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left flex flex-col justify-between transition-all group disabled:opacity-40"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400">{t('manualStep3Title')}</span>
                  <QrCode className="w-4 h-4 text-sky-400" />
                </div>
                <span className="text-[11px] text-slate-400">{t('manualStep3Desc')}</span>
              </button>

              {/* Step 4 Button */}
              <button
                id="btn-sim-step4"
                onClick={() => handleLoop2Crossing()}
                disabled={currentLane.barrierState !== 'OPEN'}
                className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left flex flex-col justify-between transition-all group disabled:opacity-40"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400">{t('manualStep4Title')}</span>
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-[11px] text-slate-400">{t('manualStep4Desc')}</span>
              </button>
            </div>

            {/* Manual Preset Injection */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{t('selectTestVehicle')}</span>
                <select
                  id="select-test-vehicle"
                  value={selectedPlate}
                  onChange={e => {
                    setSelectedPlate(e.target.value);
                    const found = demoPlates.find(p => p.plate === e.target.value);
                    if (found) setSelectedCategory(found.cat);
                  }}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 font-mono text-xs"
                >
                  {demoPlates.map(p => (
                    <option key={p.plate} value={p.plate}>
                      {p.flag} • {p.plate} ({p.cat})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">{t('categoryFeeLabel')}</span>
                <select
                  id="select-test-category"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs"
                >
                  <option value="VL">{tCategory('VL')} (500 FCFA)</option>
                  <option value="TAXI">{tCategory('TAXI')} (500 FCFA)</option>
                  <option value="MINIBUS">{tCategory('MINIBUS')} (1000 FCFA)</option>
                  <option value="BUS">{tCategory('BUS')} (1500 FCFA)</option>
                  <option value="UTIL">{tCategory('UTIL')} (800 FCFA)</option>
                  <option value="PL">{tCategory('PL')} (2000 FCFA)</option>
                  <option value="SPECIAL">{tCategory('SPECIAL')} (2500 FCFA)</option>
                  <option value="EXEMPT">{tCategory('EXEMPT')} (0 FCFA)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Central Rack & Network Supervision (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* ONDULEUR UPS PROFESSIONNEL (650 000 FCFA) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className={`w-5 h-5 ${upsMainsActive ? 'text-amber-400' : 'text-red-400'}`} />
                <div>
                  <h4 className="text-sm font-bold text-white">{t('upsTitle')}</h4>
                  <p className="text-[11px] text-slate-400">{t('upsSub')}</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  upsMainsActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500 animate-pulse'
                }`}
              >
                {upsMainsActive ? t('upsNormalMode') : t('upsBackupMode')}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px]">{t('upsInputVoltage')}</span>
                  <div className="text-base font-bold font-mono text-white mt-0.5">
                    {upsMainsActive ? '231.4 V' : '0.0 V'}
                  </div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px]">{t('upsOutputVoltage')}</span>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                    230.0 V
                  </div>
                </div>
              </div>

              {/* Battery Bar */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">{t('upsAutonomy')}</span>
                  <span className="font-mono font-bold text-white">{upsBatteryLevel}% (4h 15m)</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${upsMainsActive ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${upsBatteryLevel}%` }}
                  />
                </div>
              </div>

              <button
                onClick={toggleUpsPower}
                className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  upsMainsActive
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {upsMainsActive ? (
                  <>
                    <ZapOff className="w-3.5 h-3.5" />
                    <span>{t('simulatePowerCutBtn')}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{t('restorePowerBtn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SWITCH RÉSEAU GIGABIT & POE (425 000 FCFA) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">{t('switchTitle')}</h4>
                  <p className="text-[11px] text-slate-400">{t('switchSub')}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">16/16 UP</span>
            </div>

            {/* Switch Ports Visualization */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="grid grid-cols-8 gap-1.5">
                {switchPorts.map(p => (
                  <div
                    key={p.port}
                    title={`Port ${p.port}: ${p.name} (${p.poe ? 'PoE 48V' : 'Data'})`}
                    className="flex flex-col items-center bg-slate-900 p-1 rounded border border-slate-800 text-[9px] font-mono"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm animate-pulse mb-0.5" />
                    <span className="text-slate-400">{p.port}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                <span>{t('avgLatency')} <b className="text-emerald-400 font-mono">1.2 ms</b></span>
                <span>{t('aggBandwidth')} <b className="text-white font-mono">42.8 Mbps</b></span>
              </div>
            </div>
          </div>

          {/* NVR 4 CANAUX + DISQUE DUR (450 000 FCFA) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">{t('nvrTitle')}</h4>
                  <p className="text-[11px] text-slate-400">{t('nvrSub')}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                ● REC
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              {[
                isEn ? 'CAM 01 (Lane 01)' : 'CAM 01 (Voie 01)',
                isEn ? 'CAM 02 (Lane 02)' : 'CAM 02 (Voie 02)',
                isEn ? 'CAM 03 (Lane 03)' : 'CAM 03 (Voie 03)',
                isEn ? 'CAM 04 (Lane 04)' : 'CAM 04 (Voie 04)'
              ].map((cam, i) => (
                <div key={i} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">{cam}</span>
                  <span className="text-emerald-400 font-bold">25 FPS</span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                {t('hdd2TB')}
              </span>
              <span className="font-mono text-white">1.4 TB {t('hddFree')} (70%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: LIVE HARDWARE TELEMETRY & I/O PROTOCOL LOGS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">{t('telemetryLogsTitle')}</h3>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            {t('clearLogsBtn')}
          </button>
        </div>

        {/* Console View */}
        <div className="bg-slate-950 rounded-xl p-3 h-44 overflow-y-auto font-mono text-xs space-y-1.5 border border-slate-800">
          {logs.map(log => {
            let color = 'text-slate-300';
            if (log.type === 'success') color = 'text-emerald-400';
            if (log.type === 'warning') color = 'text-amber-400';
            if (log.type === 'alert') color = 'text-red-400 font-bold';

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-500 text-[11px]">[{log.time}]</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
                  {log.laneId}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 text-emerald-300 border border-emerald-500/20">
                  {log.module}
                </span>
                <span className={color}>{log.message}</span>
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
