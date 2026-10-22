# Système de Péage Automatisé (DDD • TDD • Playwright E2E)

Prototype complet, fonctionnel et visuel du **Système de Péage Automatisé**, développé selon les préceptes du **Domain-Driven Design (DDD)**, testé selon la rigueur du **Test-Driven Development (TDD)** et validé par une suite complète de tests **End-to-End Playwright**.

---

## 1. Architecture DDD (Domain-Driven Design)

Le système est structuré selon les 4 couches canoniques du DDD :

```
server/src/
├── domain/                  # 1. COUCHE DOMAINE (Règles métiers pures)
│   ├── entities/            # TollTransaction, TariffCategory, CashSession, User, AuditEvent
│   ├── value-objects/       # PlateNumber, Ticket, PaymentMethod, Role
│   ├── services/            # TariffCalculator, ReconciliationService
│   └── repositories/        # Interfaces : ITransactionRepository, ITariffRepository,
│                            # ICashSessionRepository, IUserRepository, IAuditRepository
│
├── application/             # 2. COUCHE APPLICATION (Cas d'utilisation & DTOs)
│   ├── use-cases/           # DetectVehicleUseCase, ProcessPaymentUseCase, CancelTransactionUseCase,
│   │                        # ManualBarrierOpenUseCase, CashSessionUseCases, TariffUseCases,
│   │                        # DashboardUseCases, ReportsUseCase, AuthUseCases
│   └── dtos/                # DTOs typés requêtes & réponses
│
├── infrastructure/          # 3. COUCHE INFRASTRUCTURE (Persistance & Intégrations)
│   ├── persistence/         # Repositories In-Memory avec SeedData (28 transactions pré-remplies)
│   ├── security/            # JwtService, PasswordService (Bcrypt)
│   ├── realtime/            # EventBroadcaster (Server-Sent Events SSE pour live dashboard)
│   └── pdf/                 # Génération de tickets & reçus PDF
│
└── presentation/            # 4. COUCHE PRÉSENTATION
    ├── controllers/         # Contrôleurs Express REST & flux SSE
    └── middlewares/         # AuthMiddleware (JWT), RoleMiddleware (RBAC)
```

---

## 2. Fonctionnalités & Modules Couverts

### 1. Authentification & Rôles
- Authentification par login / mot de passe avec génération de token JWT.
- Contrôle d'accès basé sur les rôles (RBAC) : `Admin`, `Superviseur`, `Caissier`, `Opérateur`, `Maintenance`.
- Journalisation automatique des connexions, déconnexions et refus d'accès.

### 2. Poste de Caisse (Cœur de la démo)
- **Attente véhicule** : Animation radar boucle magnétique, bouton de simulation arrivée véhicule, sélection rapide de plaques démo.
- **Détection & ANPR** : Lecture plaque d'immatriculation avec score de confiance (85-99%), classification automatique, photo simulée, ticket avec QR Code unique.
- **Paiement multi-moyens** :
  - **Espèces** : Saisie montant reçu, calcul instantané de la monnaie rendue, touches rapides billets (+500, +1 000, +2 000, +5 000, +10 000 FCFA).
  - **Wave Mobile Money** : Saisie numéro client, simulation de validation avec délai réaliste.
  - **Orange Money** : Simulation API débit avec délai réaliste.
  - **Carte bancaire** & **Badge RFID**.
- **Validation & Barrière** :
  - Animation de levée de la barrière physique (inclinaison à -75° avec boom zébré rouge et blanc).
  - Feu tricolore de passage (rouge -> vert).
  - Compte à rebours de refermeture automatique (5s).
  - Génération et impression du reçu de péage PDF avec QR Code.
- **Procédures d'urgence & d'exception** :
  - **Ouverture manuelle tracée** : Déclenchement avec motif obligatoire, levée immédiate et inscription inaltérable dans l'audit.
  - **Annulation supervisée** : Réservée aux superviseurs et administrateurs, avec motif obligatoire et trace d'audit.

### 3. Tableau de Bord Supervision (Temps Réel)
- Cartes KPI : Passages du jour, Recettes du jour (FCFA), Annulations, Ouvertures manuelles.
- Graphiques dynamiques :
  - Recettes horaires par tranche horaire de la journée.
  - Répartition des passages par catégorie de véhicule.
  - Répartition des recettes par mode de paiement.
  - Classement des opérateurs.
- Tableau des derniers passages en direct, alimenté par flux Server-Sent Events (SSE).
- Surveillance d'état des équipements de la voie (Caméra ANPR, Boucle, Barrière, Imprimante, TPE).

### 4. Gestion de Caisse
- Ouverture de session avec saisie du fond de caisse initial.
- Suivi en temps réel des encaissements par moyen de paiement et du théorique espèces dans le tiroir.
- Clôture de caisse avec saisie du comptage réel et calcul automatique de l'écart (équilibré, déficit, excédent).
- Génération et impression de la **Fiche Officielle de Clôture de Caisse en PDF**.

### 5. Gestion des Tarifs
- Liste complète des 9 catégories de véhicules :
  - `MOTO` (200 FCFA), `VL` (500 FCFA), `TAXI` (300 FCFA), `MINIBUS` (1 000 FCFA), `BUS` (1 500 FCFA), `UTIL` (800 FCFA), `PL` (2 000 FCFA), `SPECIAL` (2 500 FCFA), `EXEMPT` (0 FCFA).
- Modification de tarif avec motif obligatoire et historisation complète (date, auteur, motif).
- Activation / désactivation de catégorie et création de nouvelles catégories.

### 6. Rapports & Exports
- Période personnalisable (Aujourd'hui, 7 derniers jours, ce mois, dates libres).
- Présentation au format officiel d'entreprise avec en-tête de la société concessionnaire, synthèse, 3 tables de ventilation, et zones pour signatures et cachet.
- Export direct en **Fichier Excel (CSV UTF-8 BOM)** et **Rapport Officiel PDF**.

### 7. Journal d'Audit & Traçabilité
- Journal inaltérable horodaté avec filtrage par type d'événement (`MANUAL_BARRIER_OPEN`, `TRANSACTION_CANCELLED`, `LOGIN`, `SESSION_CLOSED`, etc.).
- Inspection détaillée du payload JSON de chaque événement.

### 8. Console Simulateur
- Injection de plaques d'essai et forçage de gabarits.
- Diagnostic réseau des passerelles mobiles (Wave, Orange Money) et télépéage RFID.

---

## 3. Données de Démonstration Pré-configurées

| Identifiant | Mot de passe | Rôle | Nom Complet |
|-------------|--------------|------|-------------|
| `admin` | `admin123` | Administrateur | Administrateur |
| `superviseur` | `super123` | Superviseur | Superviseur Principal |
| `caissier1` | `caisse123` | Caissier | Awa Diop |
| `caissier2` | `caisse123` | Caissier | Moussa Fall |

> **Bascule rapide** : Des boutons d'accès rapide en 1 clic sont disponibles sur l'écran de connexion et dans la barre supérieure de navigation.

---

## 4. Commandes et Exécution des Tests

### Lancer l'Application
```bash
# Lancer le serveur backend et l'interface client (accessible sur http://localhost:3001)
npm start
```

### Exécuter la Suite de Tests TDD (Vitest)
```bash
# 45 tests unitaires et d'intégration (14 fichiers)
npm run test:all
# ou séparément :
npm run test:unit
npm run test:integration
```

### Exécuter la Suite de Tests End-to-End (Playwright)
```bash
# 5 scénarios complets Playwright
npm run test:e2e
```
