import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';

export interface ManualBarrierOpenDTO {
  laneId: string;
  reason: string;
  userId: string;
  username: string;
}

export class ManualBarrierOpenUseCase {
  constructor(private readonly auditRepo: IAuditRepository) {}

  async execute(dto: ManualBarrierOpenDTO): Promise<{ success: boolean; message: string; openedAt: Date }> {
    if (!dto.reason || dto.reason.trim().length < 3) {
      throw new Error("Un motif explicite est obligatoire pour l'ouverture manuelle de la barrière");
    }

    const event = new AuditEvent(
      `aud-barrier-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      'MANUAL_BARRIER_OPEN',
      dto.userId,
      dto.username,
      {
        laneId: dto.laneId,
        reason: dto.reason.trim()
      }
    );

    await this.auditRepo.save(event);

    return {
      success: true,
      message: `Barrière de la voie ${dto.laneId} ouverte manuellement`,
      openedAt: event.timestamp
    };
  }
}
