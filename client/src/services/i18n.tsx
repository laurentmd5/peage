import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'fr' | 'en';

export interface Translations {
  [key: string]: {
    fr: string;
    en: string;
  };
}

export const translations = {
  // App & Header
  appTitle: { fr: 'Système de Péage Automatisé', en: 'Automated Toll System' },
  appSubtitle: { fr: 'Architecture DDD • Couverture TDD • Validation E2E Playwright', en: 'DDD Architecture • TDD Coverage • E2E Playwright Validation' },
  systemOperational: { fr: 'SYSTÈME OPÉRATIONNEL', en: 'SYSTEM OPERATIONAL' },
  centralStation: { fr: 'Gare Centrale de Péage - Bissau', en: 'Bissau Central Toll Plaza' },
  companyName: { fr: 'PÉAGE AREZKI BISSAU', en: 'AREZKI BISSAU TOLLWAY' },
  demoProfile: { fr: 'Profil Démo :', en: 'Demo Profile:' },
  logout: { fr: 'Se déconnecter', en: 'Log out' },
  prototypeV1: { fr: 'Prototype V1', en: 'Prototype V1' },
  footerText: { fr: "Système de Péage Automatisé • Concession d'Autoroute • Développé en TDD / DDD • Validation E2E Playwright", en: 'Automated Toll System • Highway Concession • Developed with TDD / DDD • Playwright E2E Validation' },

  // Tabs
  tabCaisse: { fr: 'Poste de Caisse', en: 'Toll Booth' },
  tabDashboard: { fr: 'Tableau de Bord', en: 'Dashboard' },
  tabTransactions: { fr: 'Transactions', en: 'Transactions' },
  tabTarifs: { fr: 'Gestion des Tarifs', en: 'Tariff Management' },
  tabSessions: { fr: 'Gestion de Caisse', en: 'Cash Session' },
  tabRapports: { fr: 'Rapports & Exports', en: 'Reports & Exports' },
  tabAudit: { fr: "Journal d'Audit", en: 'Audit Log' },
  tabSimulateur: { fr: 'Console Simulateur', en: 'Simulator Console' },

  // Header Session
  boothOpen: { fr: 'Ouverte', en: 'Open' },
  boothClosed: { fr: 'Caisse Fermée', en: 'Booth Closed' },
  openSessionPrompt: { fr: 'Ouvrez une session de caisse', en: 'Open a cash session' },
  collectedLabel: { fr: 'Encaissements :', en: 'Collected:' },

  // Auth / Login
  loginTitle: { fr: 'SYSTÈME DE PÉAGE AUTOMATISÉ', en: 'AUTOMATED TOLL SYSTEM' },
  loginSubtitle: { fr: "Poste de Contrôle, d'Encaissement et de Supervision d'Exploitation", en: 'Control, Payment Collection & Operational Supervision Booth' },
  usernameLabel: { fr: "Identifiant / Nom d'utilisateur *", en: 'Username / ID *' },
  passwordLabel: { fr: 'Mot de passe *', en: 'Password *' },
  loginButton: { fr: 'SE CONNECTER', en: 'LOG IN' },
  quickProfiles: { fr: 'Accès rapide profils de démonstration :', en: '1-Click Demo Profiles:' },
  invalidCredentials: { fr: 'Identifiants incorrects', en: 'Invalid credentials' },
  cashier1Sub: { fr: 'Awa Diop (Caisse)', en: 'Awa Diop (Booth)' },
  superviseurSub: { fr: 'Annulations & Audit', en: 'Cancellations & Audit' },
  adminSub: { fr: 'Tarifs & Rapports', en: 'Tariffs & Reports' },
  cashier2Sub: { fr: 'Moussa Fall (Caisse)', en: 'Moussa Fall (Booth)' },

  // Poste de Caisse
  caisseStatusLabel: { fr: 'Poste de Caisse :', en: 'Toll Booth:' },
  barrierStatusLabel: { fr: 'État barrière :', en: 'Barrier state:' },
  barrierOpenState: { fr: 'OUVERTE', en: 'OPEN' },
  barrierClosedState: { fr: 'FERMÉE', en: 'CLOSED' },
  manualOpenBtn: { fr: 'Ouverture Manuelle (Trac\u00e9e)', en: 'Manual Opening (Audited)' },
  cancelLastTxBtn: { fr: 'Annuler Dernière Transaction', en: 'Cancel Last Transaction' },
  waitingTitle: { fr: "En attente d'un véhicule", en: 'Waiting for vehicle' },
  waitingSubtitle: { fr: 'Approchez un véhicule ou générez une détection pour démarrer le cycle', en: 'Approach a vehicle or trigger detection to start toll cycle' },
  simulateArrivalBtn: { fr: 'SIMULER ARRIVÉE VÉHICULE (ANPR)', en: 'SIMULATE VEHICLE ARRIVAL (ANPR)' },
  quickPresetPrompt: { fr: 'Ou simuler un scénario prédéfini :', en: 'Or simulate a predefined scenario:' },
  vehicleDetectedTitle: { fr: 'Véhicule Détecté (Lecture ANPR)', en: 'Vehicle Detected (ANPR Reading)' },
  confidenceLabel: { fr: 'Confiance :', en: 'Confidence:' },
  camLabel: { fr: 'CAM_ANPR_VOIE_01', en: 'CAM_ANPR_LANE_01' },
  classifiedCategory: { fr: 'Catégorie classifiée :', en: 'Classified category:' },
  ticketGenerated: { fr: 'Ticket généré :', en: 'Generated ticket:' },
  calculatedTariff: { fr: 'Tarif calculé :', en: 'Calculated tariff:' },
  resetBtn: { fr: 'Réinitialiser', en: 'Reset' },
  proceedPaymentBtn: { fr: 'Procéder au paiement', en: 'Proceed to payment' },
  tollPaymentTitle: { fr: 'Encaissement du Péage', en: 'Toll Payment' },
  amountDueLabel: { fr: 'Montant dû', en: 'Amount due' },
  paymentMethodLabel: { fr: 'Moyen de paiement', en: 'Payment Method' },
  cashLabel: { fr: 'Espèces', en: 'Cash' },
  waveLabel: { fr: 'Wave Mobile Money', en: 'Wave Mobile Money' },
  orangeLabel: { fr: 'Orange Money', en: 'Orange Money' },
  cardLabel: { fr: 'Carte Bancaire', en: 'Credit/Debit Card' },
  rfidLabel: { fr: 'Badge / Télépéage RFID', en: 'RFID Tag / E-Pass' },
  cashGivenLabel: { fr: 'Montant remis par le conducteur (FCFA) :', en: 'Amount paid by driver (FCFA):' },
  quickBillsLabel: { fr: 'Touches rapides billets :', en: 'Quick bill shortcuts:' },
  exactAmountBtn: { fr: 'Montant exact', en: 'Exact amount' },
  changeReturnedLabel: { fr: 'Monnaie à rendre :', en: 'Change to return:' },
  changeToReturnBig: { fr: 'MONNAIE À RENDRE :', en: 'CHANGE TO RETURN:' },
  exactAmountNotice: { fr: 'Compte exact remis - Pas de monnaie à rendre.', en: 'Exact amount paid - No change needed.' },
  insufficientCashWarning: { fr: 'Montant inférieur au tarif dû.', en: 'Amount is less than amount due.' },
  phoneWaveLabel: { fr: 'Numéro de téléphone Wave :', en: 'Wave Phone Number:' },
  phoneOrangeLabel: { fr: 'Numéro de téléphone Orange Money :', en: 'Orange Money Phone Number:' },
  wavePromptNotice: { fr: 'Une invite de paiement sera automatiquement envoyée sur le mobile du client.', en: 'A payment push request will be sent to customer mobile.' },
  orangePromptNotice: { fr: 'Confirmation immédiate par code USSD #144# ou validation sur application Orange Money.', en: 'Immediate confirmation via USSD #144# or Orange Money app.' },
  cardTerminalNotice: { fr: 'Présentation de la carte sur le TPE bancaire de voie...', en: 'Present card to toll payment terminal...' },
  cardPinPrompt: { fr: 'Paiement sans contact ou avec saisie du code PIN.', en: 'Contactless or PIN code entry.' },
  rfidAntennaNotice: { fr: 'Lecture automatique du badge RFID DSRC 5.8 GHz en cours...', en: 'Automated 5.8 GHz RFID tag reading in progress...' },
  rfidAccountNotice: { fr: 'Débit automatique du compte abonné associé.', en: 'Associated subscriber account debited automatically.' },
  backBtn: { fr: 'Retour', en: 'Back' },
  validatePaymentBtn: { fr: 'VALIDER LE PAIEMENT ET OUVRIR BARRIÈRE', en: 'VALIDATE PAYMENT & OPEN BARRIER' },
  processingMobile: { fr: 'Traitement en cours...', en: 'Processing payment...' },
  paymentSuccessTitle: { fr: 'Paiement Validé avec Succès', en: 'Payment Successfully Validated' },
  barrierOpenSubtitle: { fr: 'Barrière de péage ouverte - Passage autorisé', en: 'Toll barrier open - Passage authorized' },
  closingInCountdown: { fr: 'Fermeture dans', en: 'Closing in' },
  printDownloadReceipt: { fr: 'Imprimer / Télécharger Reçu PDF', en: 'Print / Download PDF Receipt' },
  nextVehicleBtn: { fr: 'Véhicule suivant', en: 'Next Vehicle' },

  // Hardware & Real AI Edge Vision
  modeSimulation: { fr: 'Simulation Démo', en: 'Demo Simulation' },
  modeWebcam: { fr: '📹 Webcam PC', en: '📹 PC Webcam' },
  modeHikvision: { fr: '🎥 Caméra LAPI / ANPR', en: '🎥 ANPR Camera' },
  modeAnprCamera: { fr: '🎥 Caméra LAPI / ANPR', en: '🎥 ANPR Camera' },
  anprCameraTitle: { fr: 'Caméra Industrielle LAPI / ANPR', en: 'Industrial ANPR Camera' },
  anprCameraBadge: { fr: 'Multi-Marques (Hikvision, Dahua, Axis...)', en: 'Multi-Brand (Hikvision, Dahua, Axis...)' },
  anprCameraSubtitle: { fr: 'Flux Optique & Webhook Haute Précision', en: 'Optical Feed & High Precision Webhook' },
  anprWaitingVehicle: { fr: 'En attente de passage véhicule sur la voie...', en: 'Waiting for vehicle passage on lane...' },
  anprAutomatedBadge: { fr: '100% AUTOMATISÉ', en: '100% AUTOMATED' },
  anprLaneConnected: { fr: 'CAMÉRA VOIE CONNECTÉE', en: 'LANE CAMERA CONNECTED' },
  anprLiveOcrActive: { fr: 'LAPI HAUTE PRÉCISION ACTIF', en: 'HIGH PRECISION ANPR ACTIVE' },
  anprDetectionZone: { fr: 'ZONE DE LECTURE AUTOMATIQUE LAPI', en: 'AUTOMATIC ANPR READING ZONE' },
  hikvisionModelTitle: { fr: 'Caméra Industrielle LAPI / ANPR (Multi-Marques)', en: 'Industrial ANPR Camera (Multi-Brand)' },
  hikvisionWebhookListening: { fr: '📡 Écoute Webhook active sur /api/toll/camera-webhook', en: '📡 Webhook listening on /api/toll/camera-webhook' },
  hikvisionSimulateBtn: { fr: '⚡ Tester la liaison Webhook Caméra', en: '⚡ Test Camera Webhook Connection' },
  hikvisionLiveFeedLabel: { fr: 'Retour Optique Direct (Voie de Péage)', en: 'Direct Optical Feed (Toll Lane)' },
  startWebcamBtn: { fr: 'Activer la Webcam (Vision par Ordinateur)', en: 'Activate Webcam (Computer Vision)' },
  stopWebcamBtn: { fr: 'Arrêter la Caméra', en: 'Stop Camera' },
  autoPrintActive: { fr: 'Impression Auto : ACTIVE', en: 'Auto Print: ON' },
  autoPrintInactive: { fr: 'Impression Auto : DÉSACTIVÉE', en: 'Auto Print: OFF' },
  connectThermalBtn: { fr: 'Imprimante Thermique USB', en: 'USB Thermal Printer' },
  waitingWebcamVehicle: { fr: 'Pointez la caméra vers un véhicule ou une photo...', en: 'Point camera at a vehicle or photo...' },
  validateWebcamVehicle: { fr: '⚡ Valider le Véhicule Détecté', en: '⚡ Confirm Detected Vehicle' },
  cameraLoadingModel: { fr: 'Chargement du modèle de vision IA (Edge MobileNet)...', en: 'Loading Edge AI Vision Model (MobileNet)...' },
  liveOcrBadge: { fr: '✨ LAPI OCR En Direct', en: '✨ Live ANPR OCR' },
  plateLabel: { fr: 'Plaque', en: 'Plate' },

  // Lane Simulation & Proforma Equipment
  laneSimulationTitle: { fr: 'Simulation Voie & Barrière Physique', en: 'Lane & Physical Barrier Simulation' },
  virtualHardwareBadge: { fr: 'MATÉRIEL VIRTUEL', en: 'VIRTUAL HARDWARE' },
  passageAuthorized: { fr: 'PASSAGE AUTORISÉ', en: 'PASSAGE AUTHORIZED' },
  stopToll: { fr: 'ARRÊT PÉAGE', en: 'TOLL STOP' },
  laneEquipmentsState: { fr: 'ÉTAT DES ÉQUIPEMENTS DE LA VOIE', en: 'LANE EQUIPMENT DIAGNOSTICS' },
  proformaEquipmentSubtitle: { fr: 'Équipements Proforma AREZKI & Rôle Opérationnel', en: 'AREZKI Proforma Equipment & Operational Roles' },
  anprCamera: { fr: 'Caméra ANPR :', en: 'ANPR Camera:' },
  groundLoop: { fr: 'Boucle sol :', en: 'Ground loop:' },
  printer: { fr: 'Imprimante :', en: 'Printer:' },
  barrierArm: { fr: 'Barrière :', en: 'Barrier:' },
  eqFunctional: { fr: 'FONCTIONNEL', en: 'OPERATIONAL' },
  eqDetected: { fr: 'DÉTECTÉE', en: 'DETECTED' },
  eqWaiting: { fr: 'EN ATTENTE', en: 'WAITING' },
  eqPaperOk: { fr: 'PAPIER OK', en: 'PAPER OK' },
  eqRaised: { fr: 'LEVÉE', en: 'RAISED' },
  eqLowered: { fr: 'BAISSÉE', en: 'LOWERED' },
  eqActive: { fr: 'ACTIF', en: 'ACTIVE' },
  eqStandby: { fr: 'VEILLE', en: 'STANDBY' },
  eqTransit: { fr: 'PASSAGE EN COURS', en: 'TRANSIT' },

  // Role descriptions for each equipment
  descAnprCamera: {
    fr: "Capture optique HD infrarouge & reconnaissance OCR instantanée de plaque d'immatriculation.",
    en: "HD infrared optical capture & instant license plate OCR recognition."
  },
  descLoop1: {
    fr: "Détection magnétique de masse métallique à l'approche pour déclenchement LAPI.",
    en: "Magnetic vehicle presence mass detection upon arrival to trigger ANPR capture."
  },
  descDispenserScanner: {
    fr: "Délivrance de ticket thermique QR avec massicot & lecture optique 2D / badges abonnés.",
    en: "Automated barcode & QR ticket issuance with cutter & 2D optical barcode / RFID tag scanning."
  },
  descBarrier: {
    fr: "Contrôle physique motorisé des accès (<1,5 s) & asservissement au feu bicolore de voie.",
    en: "Motorized high-speed access barrier (<1.5s) synchronized with lane red/green traffic light."
  },
  descLoop2: {
    fr: "Sécurité franchissement véhicule, protection anti-écrasement & commande de refermeture anti-fraude.",
    en: "Vehicle transit safety detection, anti-tailgating protection & immediate auto-close command."
  },
  descInverter: {
    fr: "Alimentation secourue sans micro-coupure (0 ms) & régulation de tension du poste de voie.",
    en: "Zero-millisecond battery backup power & line voltage regulation for continuous lane uptime."
  },
  descSwitchPoE: {
    fr: "Réseau local Gigabit 1000 Mbps reliant les 4 voies de péage & télé-alimentation PoE des caméras.",
    en: "Core 1000 Mbps local network connecting all 4 toll lanes & PoE power for ANPR cameras."
  },
  descNvr: {
    fr: "Enregistrement vidéo continu 25 FPS des voies & archivage horodaté des clichés de passage (2 To).",
    en: "Continuous 25 FPS video surveillance & 2TB timestamped storage for transit evidence."
  },
  descPosPrinter: {
    fr: "Édition instantanée du reçu fiscal papier & encaissement multi-moyens (Espèces, Mobile, Carte).",
    en: "Instant thermal receipt printing & multi-payment processing (Cash, Mobile Money, Card)."
  },

  // Modals (Manual opening, cancel)
  manualOpenModalTitle: { fr: "Ouverture Manuelle de Barrière (Procédure d'Urgence)", en: 'Manual Barrier Opening (Emergency Procedure)' },
  manualOpenModalDesc: { fr: "Cette action est réservée aux urgences, convois prioritaires ou pannes matérielles. Elle sera tracée et horodatée dans le journal d'audit réglementaire.", en: 'This action is reserved for emergencies, priority convoys or equipment failure. It will be audited and logged.' },
  motifRequiredLabel: { fr: "Motif d'ouverture manuelle (obligatoire) *", en: 'Reason for manual opening (mandatory) *' },
  cancelTxModalTitle: { fr: "Annulation de Transaction de Péage", en: 'Toll Transaction Cancellation' },
  cancelTxModalDesc: { fr: "L'annulation d'un passage est une opération sensible nécessitant une justification explicite. Elle sera consignée dans le journal d'audit.", en: 'Cancelling a transaction is an audited operation requiring explicit justification.' },
  cancelReasonLabel: { fr: "Motif de l'annulation (obligatoire) *", en: 'Cancellation reason (mandatory) *' },
  cancelPrompt1: { fr: 'Erreur de classification de catégorie', en: 'Category classification error' },
  cancelPrompt2: { fr: 'Véhicule de secours prioritaire', en: 'Emergency priority vehicle' },
  cancelPrompt3: { fr: 'Passage forcé / fraude', en: 'Forced passage / violation' },
  cancelPrompt4: { fr: 'Panne TPE / Défaillance de paiement', en: 'POS malfunction / payment failure' },
  confirmCancelBtn: { fr: 'CONFIRMER ANNULATION', en: 'CONFIRM CANCELLATION' },
  confirmOpenBtn: { fr: 'CONFIRMER OUVERTURE MANUELLE', en: 'CONFIRM MANUAL OPENING' },
  closeBtn: { fr: 'Fermer', en: 'Close' },

  // Dashboard
  dashTitle: { fr: 'Tableau de Bord Supervision Temps Réel', en: 'Real-Time Supervision Dashboard' },
  dashLiveSync: { fr: 'Mise à jour instantanée SSE', en: 'SSE instant live updates' },
  passagesToday: { fr: "Passages Aujourd'hui", en: 'Passages Today' },
  nominalFlow: { fr: 'Flux nominal régulier', en: 'Standard nominal flow' },
  revenueToday: { fr: 'Recettes du Jour', en: 'Daily Revenue' },
  activeSessionsCount: { fr: 'Sessions actives :', en: 'Active sessions:' },
  cancellations: { fr: 'Annulations', en: 'Cancellations' },
  auditVerified: { fr: 'Motifs vérifiés en audit', en: 'Reasons verified in audit' },
  manualOpenings: { fr: 'Ouvertures Manuel.', en: 'Manual Openings' },
  justifiedInAudit: { fr: 'Tracées avec justification', en: 'Tracked with justification' },
  hourlyRevenueTitle: { fr: 'Recettes Horaires de la Journée (FCFA)', en: 'Hourly Revenue Breakdown (FCFA)' },
  categoryDistribution: { fr: 'Répartition par Catégorie de Véhicule', en: 'Vehicle Category Breakdown' },
  paymentDistribution: { fr: 'Répartition par Mode de Paiement', en: 'Payment Method Breakdown' },
  lastPassagesTitle: { fr: 'Derniers Passages Enregistrés', en: 'Recent Logged Passages' },
  equipmentSupervisionTitle: { fr: 'Supervision des Équipements', en: 'Equipment Health Status' },
  barrierAuto: { fr: 'Barrière automatique', en: 'Automatic Barrier' },
  lapiCam: { fr: 'Caméra ANPR LAPI', en: 'ANPR Camera' },
  loopDetector: { fr: 'Boucle de détection sol', en: 'Ground Loop Sensor' },
  thermalPrinter: { fr: 'Imprimante thermique', en: 'Thermal Printer' },
  posTerminal: { fr: 'Terminal de paiement TPE', en: 'POS Payment Terminal' },
  rateDisplay: { fr: 'Afficheur tarifaire usager', en: 'Customer Fee Display' },

  // Transactions
  txRegistryTitle: { fr: 'Registre des Transactions', en: 'Transaction Registry' },
  txTotalCount: { fr: 'transaction(s) enregistrée(s) au total', en: 'total transaction(s) recorded' },
  searchByPlatePlaceholder: { fr: 'Rechercher par plaque (ex: GB-2345)...', en: 'Search by plate (e.g. GB-2345)...' },
  allPaymentMethods: { fr: 'Tous modes de paiement', en: 'All payment methods' },
  allStatuses: { fr: 'Tous les statuts', en: 'All statuses' },
  statusCompleted: { fr: 'Validée', en: 'Completed' },
  statusCancelled: { fr: 'Annulée', en: 'Cancelled' },
  refreshBtn: { fr: 'Rafraîchir', en: 'Refresh' },
  tableDateHeader: { fr: 'DATE & HEURE', en: 'DATE & TIME' },
  tableTicketHeader: { fr: 'N° TICKET', en: 'TICKET NO.' },
  tableLaneHeader: { fr: 'VOIE', en: 'LANE' },
  tablePlateHeader: { fr: 'PLAQUE', en: 'PLATE' },
  tableCatHeader: { fr: 'CATÉGORIE', en: 'CATEGORY' },
  tableRateHeader: { fr: 'TARIF', en: 'FEE' },
  tableMethodHeader: { fr: 'MOYEN', en: 'METHOD' },
  tableCashierHeader: { fr: 'CAISSIER', en: 'CASHIER' },
  tableStatusHeader: { fr: 'STATUT', en: 'STATUS' },
  tableActionsHeader: { fr: 'ACTIONS', en: 'ACTIONS' },
  txDetailsModalTitle: { fr: 'Détails de la Transaction', en: 'Transaction Details' },
  reprintReceiptBtn: { fr: 'Réimprimer Reçu', en: 'Reprint Receipt' },

  // Tarifs
  tarifsTitle: { fr: 'Gestion de la Grille Tarifaire', en: 'Tariff Grid Management' },
  tarifsSubtitle: { fr: 'Configuration des catégories de véhicules, des barèmes et traçabilité des révisions', en: 'Vehicle categories configuration, toll rates & revision audit trail' },
  newCategoryBtn: { fr: 'Nouvelle Catégorie', en: 'New Category' },
  tableCodeHeader: { fr: 'CODE', en: 'CODE' },
  tableLabelHeader: { fr: 'LIBELLÉ CATÉGORIE', en: 'CATEGORY LABEL' },
  tableCurrentRateHeader: { fr: 'TARIF ACTUEL', en: 'CURRENT RATE' },
  tableRevisionsHeader: { fr: 'RÉVISIONS', en: 'REVISIONS' },
  tableActiveHeader: { fr: 'ACTIF', en: 'ACTIVE' },
  tableModifyHeader: { fr: 'MODIFIER TARIF', en: 'UPDATE RATE' },
  editTariffModalTitle: { fr: 'Modifier le tarif', en: 'Update Tariff Rate' },
  categoryToModify: { fr: 'Catégorie à modifier :', en: 'Category to modify:' },
  currentRateLabel: { fr: 'Tarif actuel :', en: 'Current rate:' },
  newRateLabel: { fr: 'Nouveau tarif (FCFA) *', en: 'New rate (FCFA) *' },
  revisionReasonLabel: { fr: 'Motif officiel de la révision (obligatoire pour audit) *', en: 'Official revision justification (mandatory for audit) *' },
  historyModalTitle: { fr: 'Historique des Révisions', en: 'Revision History' },
  createNewCategoryTitle: { fr: 'Créer une Nouvelle Catégorie Tarifaire', en: 'Create New Tariff Category' },

  // Caisse Sessions
  caisseSessionTitle: { fr: 'Gestion de Session de Caisse', en: 'Cash Session Management' },
  caisseSessionSubtitle: { fr: "Ouverture de poste, suivi du tiroir-caisse et clôture avec calcul d'écart", en: 'Shift opening, drawer balance tracking & closing reconciliation' },
  currentActiveSessionTitle: { fr: 'Session Active', en: 'Active Session' },
  openNewSessionTitle: { fr: "Ouverture d'un Poste de Caisse", en: 'Open a Toll Booth Shift' },
  initialFloatLabel: { fr: 'Fond de caisse initial (FCFA) *', en: 'Initial float / cash fund (FCFA) *' },
  openShiftBtn: { fr: 'OUVRIR LA SESSION DE CAISSE', en: 'OPEN CASH SESSION' },
  closeShiftBtn: { fr: 'CLÔTURER LE POSTE DE CAISSE', en: 'CLOSE CASH SHIFT (RECONCILIATION)' },
  drawerSummary: { fr: 'Bilan du Tiroir-Caisse', en: 'Cash Drawer Summary' },
  initialFloat: { fr: 'Fond initial :', en: 'Initial float:' },
  cashCollected: { fr: 'Espèces encaissées :', en: 'Cash collected:' },
  expectedCash: { fr: 'Théorique en caisse :', en: 'Expected in drawer:' },
  totalCollectedAll: { fr: 'Total Toutes Recettes :', en: 'Total All Revenues:' },
  closeReconciliationModalTitle: { fr: 'Clôture et Rapprochement du Tiroir Caisse', en: 'Shift Closing & Financial Reconciliation' },
  realCountLabel: { fr: 'Montant réel en espèces compté dans le tiroir (FCFA) *', en: 'Actual counted cash in drawer (FCFA) *' },
  expectedTheoreticalCash: { fr: 'Théorique attendu en espèces :', en: 'Expected theoretical cash:' },
  calculatedDiscrepancy: { fr: 'Écart de caisse calculé :', en: 'Calculated cash discrepancy:' },
  balancedCashNotice: { fr: 'Équilibré', en: 'Balanced' },
  surplusNotice: { fr: 'Excédent', en: 'Surplus' },
  deficitNotice: { fr: 'Déficit', en: 'Deficit' },
  generateReportBtn: { fr: 'Imprimer Fiche de Clôture PDF', en: 'Print Shift Closing PDF' },

  // Rapports & Exports
  reportsTitle: { fr: "Rapports & États d'Exploitation", en: 'Operational Reports & Statements' },
  reportsSubtitle: { fr: 'Consolidation périodique des flux, recettes, annulations et contrôles', en: 'Periodic consolidation of traffic flows, revenues, cancellations and controls' },
  exportCsvBtn: { fr: 'Exporter Excel / CSV', en: 'Export Excel / CSV' },
  exportPdfBtn: { fr: 'Générer Rapport PDF Officiel', en: 'Generate Official PDF Report' },
  periodFrom: { fr: 'Période du :', en: 'Period from:' },
  periodTo: { fr: 'au :', en: 'to:' },
  todayFilter: { fr: "Aujourd'hui", en: 'Today' },
  last7DaysFilter: { fr: '7 derniers jours', en: 'Last 7 days' },
  thisMonthFilter: { fr: 'Ce mois', en: 'This month' },
  officialReportHeader: { fr: 'SOCIÉTÉ D\'EXPLOITATION DU PÉAGE AREZKI BISSAU', en: 'AREZKI BISSAU TOLLWAY OPERATING CONCESSION' },
  officialReportSub: { fr: "Service d'Exploitation & Audit Financier", en: 'Operations & Financial Audit Department' },
  totalPassagesReport: { fr: 'TOTAL PASSAGES', en: 'TOTAL PASSAGES' },
  totalRevenuesReport: { fr: 'RECETTES TOTALES', en: 'TOTAL REVENUE' },
  totalCancellationsReport: { fr: 'ANNULATIONS', en: 'CANCELLATIONS' },
  totalManualOpeningsReport: { fr: 'OUV. MANUELLES', en: 'MANUAL OPENINGS' },
  ventilationByCategory: { fr: '1. VENTILATION PAR CATÉGORIE DE VÉHICULE', en: '1. BREAKDOWN BY VEHICLE CATEGORY' },
  ventilationByPayment: { fr: '2. VENTILATION PAR MOYEN DE PAIEMENT', en: '2. BREAKDOWN BY PAYMENT METHOD' },
  ventilationByCashier: { fr: '3. VENTILATION PAR CAISSIER / OPÉRATEUR', en: '3. BREAKDOWN BY CASHIER / OPERATOR' },
  signatureExploitation: { fr: "Le Responsable d'Exploitation :", en: 'Operations Manager:' },
  signatureDirection: { fr: 'Visa & Cachet de la Direction :', en: 'Management Approval & Official Stamp:' },
  dateAndSig: { fr: 'Date et signature', en: 'Date and signature' },
  officialStamp: { fr: 'Cachet officiel', en: 'Official stamp' },

  // Audit Log
  auditTitle: { fr: "Journal d'Audit & Traçabilité Réglementaire", en: 'Regulatory Audit Log & Traceability' },
  auditSubtitle: { fr: 'Registre inaltérable des opérations critiques, ouvertures manuelles et annulations', en: 'Immutable record of critical operations, manual openings and cancellations' },
  allEventTypes: { fr: "Tous les types d'événements", en: 'All event types' },
  tableTimestampHeader: { fr: 'HORODATAGE', en: 'TIMESTAMP' },
  tableEventTypeHeader: { fr: "TYPE D'ÉVÉNEMENT", en: 'EVENT TYPE' },
  tableOperatorHeader: { fr: 'OPÉRATEUR', en: 'OPERATOR' },
  tableSummaryHeader: { fr: "RÉSUMÉ DE L'OPÉRATION", en: 'OPERATION SUMMARY' },
  tableDetailsHeader: { fr: 'DÉTAILS', en: 'DETAILS' },
  eventDetailsModalTitle: { fr: "Détail de l'Événement d'Audit", en: 'Audit Event Payload Details' },

  // Simulateur
  simTitle: { fr: "Console des Simulateurs d'Équipements — Banc d'Essai Multi-Voies", en: 'Equipment Simulator Console — Multi-Lane Test Bench' },
  simSubtitle: { fr: "Simulation temps réel conforme Proforma NETSYSTEME #PRO-20260926-313 • Client AREZKI BISSAU (4 Voies)", en: 'Real-time simulation compliant with NETSYSTEME Proforma #PRO-20260926-313 • Client AREZKI BISSAU (4 Lanes)' },
  simAnprTitle: { fr: 'Simulateur Caméra LAPI / ANPR 4 MP', en: '4 MP ANPR Camera Simulator' },
  selectDemoPlate: { fr: 'Sélectionner une plaque de démonstration :', en: 'Select a demonstration plate:' },
  forceCategory: { fr: 'Forcer la classification du gabarit :', en: 'Force category classification:' },
  triggerDetectionBtn: { fr: "Déclencher l'arrivée sur le poste de caisse", en: 'Trigger arrival at toll booth' },
  gatewaysTitle: { fr: 'Réseau & Passerelles Paiement', en: 'Network & Payment Gateways' },
  waveGateway: { fr: 'Passerelle Wave Mobile Money', en: 'Wave Mobile Money Gateway' },
  orangeGateway: { fr: 'Passerelle Orange Money API', en: 'Orange Money API Gateway' },
  rfidServer: { fr: 'Serveur Télépéage RFID DSRC 5.8 GHz', en: 'RFID DSRC 5.8 GHz Toll Server' },
  connectedState: { fr: 'CONNECTÉ', en: 'CONNECTED' },
  activeState: { fr: 'ACTIF', en: 'ACTIVE' },
  latency: { fr: 'Latence moyenne :', en: 'Average latency:' },

  // Proforma Hardware Matrix
  proformaBadge: { fr: 'PROFORMA #PRO-20260926-313 • AREZKI BISSAU', en: 'PROFORMA #PRO-20260926-313 • AREZKI BISSAU' },
  proformaBudget: { fr: 'Budget Devis : 35 575 000 FCFA HT', en: 'Quoted Budget: 35,575,000 FCFA HT' },
  laneSelector: { fr: 'Sélection de la Voie de Contrôle :', en: 'Control Lane Selection:' },
  lane1Title: { fr: 'Voie 01 - VL Entrée', en: 'Lane 01 - Light Vehicles' },
  lane2Title: { fr: 'Voie 02 - Mixte VL / Taxi', en: 'Lane 02 - Mixed Cars/Taxis' },
  lane3Title: { fr: 'Voie 03 - Poids Lourds PL', en: 'Lane 03 - Heavy Trucks PL' },
  lane4Title: { fr: 'Voie 04 - Express Télépéage', en: 'Lane 04 - Express E-Pass' },
  loop1Name: { fr: 'Boucle 1 (Amont / Présence)', en: 'Loop 1 (Entry / Presence)' },
  loop2Name: { fr: 'Boucle 2 (Aval / Sécurité)', en: 'Loop 2 (Exit / Safety)' },
  anpr4MPName: { fr: 'Caméra ANPR 4 MP', en: '4 MP ANPR Camera' },
  ticketDispenserName: { fr: 'Borne de Délivrance Tickets', en: 'Automatic Ticket Dispenser' },
  qrScannerName: { fr: 'Lecteur QR Code 2D', en: '2D QR Code Scanner' },
  barrierUnitName: { fr: 'Barrière Automatique', en: 'Automatic Barrier Gate' },
  rackServerTitle: { fr: 'Baie Technique Centrale & Réseau (Proforma)', en: 'Central Server Rack & Network (Proforma)' },
  upsTitle: { fr: 'Onduleur UPS Professionnel', en: 'Professional UPS Inverter' },
  upsNormalMode: { fr: 'SECTEUR 230V ACTIF', en: 'MAINS 230V ACTIVE' },
  upsBackupMode: { fr: 'SECOURS BATTERIE ACTIF', en: 'BATTERY BACKUP ACTIVE' },
  simulatePowerCutBtn: { fr: 'Simuler Coupure Secteur', en: 'Simulate Mains Outage' },
  restorePowerBtn: { fr: 'Rétablir le Secteur', en: 'Restore Mains Power' },
  switchTitle: { fr: 'Switch Réseau Gigabit & PoE', en: 'Gigabit & PoE Network Switch' },
  nvrTitle: { fr: 'NVR 4 Canaux & Stockage', en: '4-Channel NVR & Storage' },
  autoTrafficTitle: { fr: 'Mode Démo Salon : Trafic Automatisé Continu', en: 'Presentation Mode: Continuous Automated Traffic' },
  startTrafficBtn: { fr: 'LANCER LE TRAFIC AUTOMATIQUE', en: 'START AUTOMATED TRAFFIC' },
  stopTrafficBtn: { fr: 'ARRÊTER LE TRAFIC', en: 'STOP TRAFFIC' },
  telemetryLogsTitle: { fr: 'Télémétrie et Trames Matérielles I/O en Direct', en: 'Live Hardware I/O & Telemetry Logs' },

  fourLanesMatrixTitle: { fr: 'Matrice des 4 Voies de Péage (Proforma NETSYSTEME)', en: '4-Lane Tollway Matrix (NETSYSTEME Proforma)' },
  fourLanesMatrixSubtitle: { fr: '4 Barrières • 8 Boucles Détecteurs • 4 Caméras 4MP • 4 Bornes Tickets • 4 Postes', en: '4 Barrier Gates • 8 Loop Detectors • 4 4MP Cameras • 4 Ticket Dispensers • 4 POS' },
  barrierHighBadge: { fr: 'BARRIÈRE HAUTE', en: 'BARRIER RAISED' },
  laneOccupiedBadge: { fr: 'OCCUPÉE', en: 'OCCUPIED' },
  laneFreeBadge: { fr: 'VOIE LIBRE', en: 'LANE FREE' },
  passagesCountLabel: { fr: 'Passages :', en: 'Passages:' },
  laneHardwareDesc: { fr: 'Automate de voie, Détecteurs doubles boucles, Caméra 4MP et Barrière motorisée', en: 'Lane PLC Controller, Dual Loop Detectors, 4MP Camera & Motorized Barrier' },
  step1Loop: { fr: '1. Boucle 1', en: '1. Loop 1' },
  step2Anpr: { fr: '2. ANPR', en: '2. ANPR' },
  step3Dispenser: { fr: '3. Borne', en: '3. Dispenser' },
  step4Barrier: { fr: '4. Barrière', en: '4. Barrier' },
  step5Loop: { fr: '5. Boucle 2', en: '5. Loop 2' },
  loop1Label: { fr: 'BOUCLE 1', en: 'LOOP 1' },
  loop1Sub: { fr: 'Amont (Présence)', en: 'Entry (Presence)' },
  loopDetectionBadge: { fr: 'DÉTECTION', en: 'DETECTION' },
  loopIdleBadge: { fr: 'VEILLE', en: 'STANDBY' },
  borneTicketLabel: { fr: 'BORNE TICKET', en: 'TICKET DISPENSER' },
  ticketDispensedBadge: { fr: 'TICKET SORTI', en: 'TICKET ISSUED' },
  pressBtnLabel: { fr: 'APPUYER', en: 'PRESS' },
  barrierCabinetLabel: { fr: 'BARRIÈRE', en: 'BARRIER' },
  loop2Label: { fr: 'BOUCLE 2', en: 'LOOP 2' },
  loop2Sub: { fr: 'Aval (Sécurité)', en: 'Exit (Safety)' },
  loopCrossingBadge: { fr: 'FRANCHISSEMENT', en: 'CROSSING' },
  manualControlsTitle: { fr: "Contrôles Manuels du Banc d'Essai Voie", en: 'Manual Lane Test Bench Controls' },
  manualStep1Title: { fr: '1. Détection & ANPR', en: '1. Detection & ANPR' },
  manualStep1Desc: { fr: 'Exciter Boucle 1 & capture caméra 4MP', en: 'Trip Loop 1 & trigger 4MP camera' },
  manualStep2Title: { fr: '2. Borne Ticket', en: '2. Ticket Dispenser' },
  manualStep2Desc: { fr: 'Appuyer bouton & imprimer ticket QR', en: 'Press button & print QR ticket' },
  manualStep3Title: { fr: '3. Scanner 2D & Pay', en: '3. 2D Scanner & Pay' },
  manualStep3Desc: { fr: 'Scan ticket, encaisse & ouvre barrière', en: 'Scan ticket, pay & open barrier' },
  manualStep4Title: { fr: '4. Boucle 2 & Fermer', en: '4. Loop 2 & Close' },
  manualStep4Desc: { fr: 'Franchit Boucle 2 & referme barrière', en: 'Cross Loop 2 & auto-close barrier' },
  selectTestVehicle: { fr: 'Sélectionner véhicule test :', en: 'Select test vehicle:' },
  categoryFeeLabel: { fr: 'Catégorie tarif :', en: 'Tariff category:' },
  upsSub: { fr: 'Alimentation secourue 230V Proforma', en: '230V Protected Power Supply (Proforma)' },
  upsInputVoltage: { fr: "Tension d'entrée :", en: 'Input Voltage:' },
  upsOutputVoltage: { fr: 'Tension sortie :', en: 'Output Voltage:' },
  upsAutonomy: { fr: 'Autonomie batterie :', en: 'Battery Autonomy:' },
  switchSub: { fr: '16 Ports RJ45 Connectés (1000 Mbps)', en: '16 RJ45 Connected Ports (1000 Mbps)' },
  avgLatency: { fr: 'Latence moyenne :', en: 'Average latency:' },
  aggBandwidth: { fr: 'Débit agrégé :', en: 'Aggregated throughput:' },
  nvrSub: { fr: 'Surveillance 4 flux vidéo 4MP', en: 'Surveillance of 4 4MP video streams' },
  hdd2TB: { fr: 'Disque Dur 2 To :', en: '2 TB Hard Drive:' },
  hddFree: { fr: 'libre', en: 'free' },
  clearLogsBtn: { fr: 'Effacer les logs', en: 'Clear logs' },
  upsActiveMains: { fr: 'UPS 230V Secteur (98%)', en: 'UPS 230V Mains (98%)' },
  upsActiveBattery: { fr: '⚡ UPS SECOURS BATTERIE', en: '⚡ UPS BATTERY BACKUP' }
};

export const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  CAT1: { fr: 'Catégorie 1 (Motos, Tricycles & Taxis)', en: 'Category 1 (Motorcycles, Tricycles & Taxis)' },
  CAT2: { fr: 'Catégorie 2 (Voitures & Pick-up double cabine)', en: 'Category 2 (Cars & Double-Cab Pickups)' },
  CAT3: { fr: 'Catégorie 3 (Canter, Bus & Mini-camions)', en: 'Category 3 (Canter, Buses & Mini-Trucks)' },
  CAT4: { fr: 'Catégorie 4 (Camions porteurs 7t à 20t)', en: 'Category 4 (Trucks 7t to 20t)' },
  CAT5: { fr: 'Catégorie 5 (Semi-remorques & Trains routiers >20t)', en: 'Category 5 (Semi-Trailers & Heavy Trailers >20t)' },
  MOTO: { fr: 'Moto', en: 'Motorcycle' },
  VL: { fr: 'Véhicule léger', en: 'Light Vehicle' },
  TAXI: { fr: 'Taxi / VTC', en: 'Taxi / Rideshare' },
  MINIBUS: { fr: 'Minibus', en: 'Minibus' },
  BUS: { fr: 'Bus', en: 'Bus' },
  UTIL: { fr: 'Utilitaire', en: 'Utility / Van' },
  PL: { fr: 'Poids lourd', en: 'Heavy Goods / Truck' },
  SPECIAL: { fr: 'Véhicule spécial', en: 'Special Vehicle' },
  EXEMPT: { fr: 'Véhicule exempté', en: 'Exempted Vehicle' }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations) => string;
  tCategory: (code?: string, fallbackLabel?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('peage_lang') as Language) || 'fr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('peage_lang', lang);
  };

  const t = (key: keyof typeof translations): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry.fr || key;
  };

  const tCategory = (code?: string, fallbackLabel?: string): string => {
    if (!code) return fallbackLabel || '';
    const cat = CATEGORY_LABELS[code.toUpperCase()];
    if (cat) {
      return cat[language] || cat.fr;
    }
    return fallbackLabel || code;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tCategory }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
