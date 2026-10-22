import { ICashSessionRepository } from '../../domain/repositories/ICashSessionRepository.ts';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { CashSession } from '../../domain/entities/CashSession.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';
import { OpenSessionRequestDTO, CloseSessionRequestDTO, CashSessionDTO } from '../dtos/CaisseDTO.ts';

export class CashSessionUseCases {
  constructor(
    private readonly sessionRepo: ICashSessionRepository,
    private readonly auditRepo: IAuditRepository
  ) {}

  async openSession(dto: OpenSessionRequestDTO): Promise<CashSessionDTO> {
    const existing = await this.sessionRepo.findActiveByCashier(dto.cashierId);
    if (existing) {
      return this.mapToDTO(existing);
    }

    const sessionId = `cs-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const session = new CashSession(
      sessionId,
      dto.cashierId,
      dto.cashierName,
      dto.boothId,
      dto.initialFloat,
      new Date(),
      'OPEN'
    );

    await this.sessionRepo.save(session);

    await this.auditRepo.save(
      new AuditEvent(
        `aud-open-${Date.now()}`,
        'SESSION_OPENED',
        dto.cashierId,
        dto.cashierName,
        {
          sessionId: session.id,
          boothId: session.boothId,
          initialFloat: session.initialFloat
        }
      )
    );

    return this.mapToDTO(session);
  }

  async getActiveSession(cashierId: string): Promise<CashSessionDTO | null> {
    const session = await this.sessionRepo.findActiveByCashier(cashierId);
    return session ? this.mapToDTO(session) : null;
  }

  async closeSession(dto: CloseSessionRequestDTO, userId: string, username: string): Promise<CashSessionDTO> {
    const session = await this.sessionRepo.findById(dto.sessionId);
    if (!session) {
      throw new Error(`Session introuvable: ${dto.sessionId}`);
    }

    const result = session.close(dto.realCashCounted);
    await this.sessionRepo.save(session);

    await this.auditRepo.save(
      new AuditEvent(
        `aud-close-${Date.now()}`,
        'SESSION_CLOSED',
        userId,
        username,
        {
          sessionId: session.id,
          expectedCash: result.expectedCash,
          realCash: result.realCash,
          discrepancy: result.discrepancy,
          totalCollected: session.totalCollected
        }
      )
    );

    return this.mapToDTO(session);
  }

  private mapToDTO(session: CashSession): CashSessionDTO {
    return {
      id: session.id,
      cashierId: session.cashierId,
      cashierName: session.cashierName,
      boothId: session.boothId,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      initialFloat: session.initialFloat,
      totalCollected: session.totalCollected,
      expectedCashInDrawer: session.expectedCashInDrawer,
      realCashCounted: session.realCashCounted,
      discrepancy: session.discrepancy,
      status: session.status,
      breakdown: session.breakdown
    };
  }
}
