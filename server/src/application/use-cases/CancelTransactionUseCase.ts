import { ITransactionRepository } from '../../domain/repositories/ITransactionRepository.ts';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';
import { CancelTransactionRequestDTO, TransactionDTO } from '../dtos/TransactionDTO.ts';
import { UserRole } from '../../domain/value-objects/Role.ts';

export class CancelTransactionUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly auditRepo: IAuditRepository
  ) {}

  async execute(dto: CancelTransactionRequestDTO): Promise<TransactionDTO> {
    if (dto.userRole !== UserRole.ADMIN && dto.userRole !== UserRole.SUPERVISEUR) {
      // Log access denied attempt
      await this.auditRepo.save(
        new AuditEvent(
          `aud-denied-${Date.now()}`,
          'ACCESS_DENIED',
          dto.userId,
          dto.cancelledBy,
          {
            action: 'CANCEL_TRANSACTION',
            transactionId: dto.transactionId,
            reason: dto.reason
          }
        )
      );
      throw new Error("Seuls les administrateurs et superviseurs ont l'autorisation d'annuler une transaction");
    }

    const transaction = await this.transactionRepo.findById(dto.transactionId);
    if (!transaction) {
      throw new Error(`Transaction introuvable: ${dto.transactionId}`);
    }

    transaction.cancel(dto.cancelledBy, dto.reason);
    await this.transactionRepo.save(transaction);

    // Audit log
    await this.auditRepo.save(
      new AuditEvent(
        `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        'TRANSACTION_CANCELLED',
        dto.userId,
        dto.cancelledBy,
        {
          transactionId: transaction.id,
          ticketNumber: transaction.ticketNumber,
          plate: transaction.plateNumber,
          amount: transaction.amountDue,
          reason: dto.reason
        }
      )
    );

    return {
      id: transaction.id,
      ticketNumber: transaction.ticketNumber,
      laneId: transaction.laneId,
      plateNumber: transaction.plateNumber,
      categoryCode: transaction.categoryCode,
      categoryLabel: transaction.categoryLabel,
      amountDue: transaction.amountDue,
      amountPaid: transaction.amountPaid,
      changeReturned: transaction.changeReturned,
      paymentMethod: transaction.paymentMethod,
      cashierId: transaction.cashierId,
      cashierName: transaction.cashierName,
      status: transaction.status,
      createdAt: transaction.createdAt,
      cancelledAt: transaction.cancelledAt,
      cancellationReason: transaction.cancellationReason,
      cancelledBy: transaction.cancelledBy
    };
  }
}
