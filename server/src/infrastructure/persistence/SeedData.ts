import { InMemoryUserRepository } from './InMemoryUserRepository.ts';
import { InMemoryTariffRepository } from './InMemoryTariffRepository.ts';
import { InMemoryTransactionRepository } from './InMemoryTransactionRepository.ts';
import { InMemoryCashSessionRepository } from './InMemoryCashSessionRepository.ts';
import { InMemoryAuditRepository } from './InMemoryAuditRepository.ts';
import { User } from '../../domain/entities/User.ts';
import { UserRole } from '../../domain/value-objects/Role.ts';
import { TariffCategory } from '../../domain/entities/TariffCategory.ts';
import { TollTransaction } from '../../domain/entities/TollTransaction.ts';
import { CashSession } from '../../domain/entities/CashSession.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';
import { PaymentMethod } from '../../domain/value-objects/PaymentMethod.ts';
import { PasswordService } from '../security/PasswordService.ts';

export async function seedDatabase(
  userRepo: InMemoryUserRepository,
  tariffRepo: InMemoryTariffRepository,
  transactionRepo: InMemoryTransactionRepository,
  sessionRepo: InMemoryCashSessionRepository,
  auditRepo: InMemoryAuditRepository
): Promise<void> {
  // 1. Seed Users
  const pwAdmin = await PasswordService.hash('admin123');
  const pwSuper = await PasswordService.hash('super123');
  const pwCaisse = await PasswordService.hash('caisse123');

  const admin = new User('u-admin', 'admin', pwAdmin, UserRole.ADMIN, 'Administrateur');
  const superv = new User('u-super', 'superviseur', pwSuper, UserRole.SUPERVISEUR, 'Superviseur Principal');
  const caisse1 = new User('u-caisse1', 'caissier1', pwCaisse, UserRole.CAISSIER, 'Caissier 1');
  const caisse2 = new User('u-caisse2', 'caissier2', pwCaisse, UserRole.CAISSIER, 'Caissier 2');

  await userRepo.save(admin);
  await userRepo.save(superv);
  await userRepo.save(caisse1);
  await userRepo.save(caisse2);

  // 2. Seed Tariff Categories (Grille Officielle AREZKI BISSAU - 5 Catégories + Exempté)
  const categoriesData = [
    { code: 'CAT1', label: 'Catégorie 1 (Motos, Tricycles & Taxis)', rate: 250 },
    { code: 'CAT2', label: 'Catégorie 2 (Voitures & Pick-up double cabine)', rate: 500 },
    { code: 'CAT3', label: 'Catégorie 3 (Canter, Bus & Mini-camions)', rate: 1500 },
    { code: 'CAT4', label: 'Catégorie 4 (Camions porteurs 7t à 20t)', rate: 5000 },
    { code: 'CAT5', label: 'Catégorie 5 (Semi-remorques & Trains routiers >20t)', rate: 10000 },
    { code: 'EXEMPT', label: 'Véhicule exempté (Secours / Police)', rate: 0 }
  ];

  for (const c of categoriesData) {
    const cat = new TariffCategory(c.code, c.label, c.rate, true, [
      { rate: c.rate, effectiveDate: new Date(Date.now() - 30 * 24 * 3600 * 1000), changedBy: 'admin', reason: 'Tarif initial' }
    ]);
    await tariffRepo.save(cat);
  }

  // 3. Seed Cash Session for Caisse 1 (Active)
  const activeSession = new CashSession('cs-active-01', caisse1.id, caisse1.fullName, 'CAISSE-01', 25000);
  await sessionRepo.save(activeSession);

  // 4. Seed 25-30 Transactions over last 7 days (Matriculations officielles Guinée-Bissau AREZKI - Type GB)
  const demoPlates = [
    'GB-1234-AA', 'GB-5678-BB', 'GB-9012-CC', 'GB-3456-DD',
    'GB-7890-EE', 'GB-2345-AF', 'GB-6789-AG', 'GB-4321-AH',
    'GB-8765-AJ', 'GB-1357-AK', 'GB-2468-AL', 'GB-9876-GB'
  ];

  const methods = [
    PaymentMethod.ESPECES,
    PaymentMethod.WAVE,
    PaymentMethod.ORANGE_MONEY,
    PaymentMethod.CARTE,
    PaymentMethod.RFID
  ];

  const now = Date.now();
  const startOfTodayMs = new Date().setHours(0, 0, 0, 0);

  for (let i = 0; i < 28; i++) {
    // 12 transactions strictly today, rest over past 6 days
    const isToday = i < 12;
    let txTime: Date;

    if (isToday) {
      // Pick time between startOfToday and now (or at least within today)
      const offsetMs = Math.floor((i / 12) * Math.min(now - startOfTodayMs, 14 * 3600 * 1000));
      txTime = new Date(startOfTodayMs + offsetMs);
    } else {
      const daysAgo = Math.floor(Math.random() * 6) + 1;
      const hoursAgo = Math.floor(Math.random() * 23);
      txTime = new Date(now - (daysAgo * 24 * 3600 * 1000) - (hoursAgo * 3600 * 1000));
    }

    const plate = demoPlates[i % demoPlates.length];
    const catObj = categoriesData[i % categoriesData.length];
    const method = methods[i % methods.length];
    const cashier = i % 2 === 0 ? caisse1 : caisse2;
    const laneId = i % 2 === 0 ? 'CAISSE-01' : 'CAISSE-02';

    const amountDue = catObj.rate;
    let amountPaid = amountDue;
    let changeReturned = 0;

    if (method === PaymentMethod.ESPECES && amountDue > 0) {
      if (amountDue <= 250) {
        amountPaid = 500;
      } else if (amountDue <= 500) {
        amountPaid = 1000;
      } else if (amountDue <= 1500) {
        amountPaid = 2000;
      } else if (amountDue <= 5000) {
        amountPaid = 5000;
      } else {
        amountPaid = 10000;
      }
      changeReturned = amountPaid - amountDue;
    }

    const ticketNumber = `TK-${txTime.toISOString().slice(0, 10).replace(/-/g, '')}-${1000 + i}`;

    const tx = new TollTransaction(
      `tx-seed-${i + 1}`,
      ticketNumber,
      laneId,
      plate,
      catObj.code,
      catObj.label,
      amountDue,
      amountPaid,
      changeReturned,
      method,
      cashier.id,
      cashier.fullName,
      'COMPLETED',
      txTime
    );

    // Cancel 2 specific transactions for demonstration
    if (i === 4) {
      tx.cancel('superviseur', 'Erreur de saisie catégorie par le caissier');
    } else if (i === 11) {
      tx.cancel('admin', 'Véhicule d\'urgence prioritaire ayant forcé le passage');
    } else if (isToday && laneId === 'CAISSE-01') {
      activeSession.registerTransaction(method, amountDue);
    }

    await transactionRepo.save(tx);
  }

  await sessionRepo.save(activeSession);

  // 5. Seed Audit Events
  await auditRepo.save(
    new AuditEvent(
      'aud-seed-1',
      'LOGIN',
      caisse1.id,
      caisse1.username,
      { role: caisse1.role },
      new Date(now - 4 * 3600 * 1000)
    )
  );

  await auditRepo.save(
    new AuditEvent(
      'aud-seed-2',
      'SESSION_OPENED',
      caisse1.id,
      caisse1.username,
      { sessionId: activeSession.id, boothId: 'CAISSE-01', initialFloat: 25000 },
      new Date(now - 4 * 3600 * 1000)
    )
  );

  await auditRepo.save(
    new AuditEvent(
      'aud-seed-3',
      'MANUAL_BARRIER_OPEN',
      superv.id,
      superv.username,
      { laneId: 'CAISSE-01', reason: 'Passage convoi officiel sous escorte' },
      new Date(now - 2 * 3600 * 1000)
    )
  );

  await auditRepo.save(
    new AuditEvent(
      'aud-seed-4',
      'TRANSACTION_CANCELLED',
      superv.id,
      superv.username,
      { transactionId: 'tx-seed-5', ticketNumber: 'TK-20260928-1004', reason: 'Erreur de saisie catégorie' },
      new Date(now - 1 * 3600 * 1000)
    )
  );
}
