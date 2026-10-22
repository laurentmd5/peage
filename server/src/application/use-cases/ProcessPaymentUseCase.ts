import { ITransactionRepository } from '../../domain/repositories/ITransactionRepository.ts';
import { ICashSessionRepository } from '../../domain/repositories/ICashSessionRepository.ts';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { TollTransaction } from '../../domain/entities/TollTransaction.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';
import { ProcessPaymentRequestDTO, TransactionDTO } from '../dtos/TransactionDTO.ts';

export class ProcessPaymentUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly cashSessionRepo: ICashSessionRepository,
    private readonly auditRepo: IAuditRepository
  ) {}

  async execute(dto: ProcessPaymentRequestDTO): Promise<TransactionDTO> {
    const changeReturned = Math.max(0, dto.amountPaid - dto.amountDue);

    const transactionId = `tx-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const transaction = new TollTransaction(
      transactionId,
      dto.ticketNumber,
      dto.laneId,
      dto.plateNumber,
      dto.categoryCode,
      dto.categoryLabel,
      dto.amountDue,
      dto.amountPaid,
      changeReturned,
      dto.paymentMethod,
      dto.cashierId,
      dto.cashierName,
      'COMPLETED',
      new Date(),
      undefined,
      undefined,
      undefined,
      dto.qrCodeData
    );

    // Persist transaction
    await this.transactionRepo.save(transaction);

    // Update active cash session if present
    let activeSession = dto.sessionId
      ? await this.cashSessionRepo.findById(dto.sessionId)
      : await this.cashSessionRepo.findActiveByCashier(dto.cashierId);

    if (activeSession && activeSession.status === 'OPEN') {
      activeSession.registerTransaction(dto.paymentMethod, dto.amountDue);
      await this.cashSessionRepo.save(activeSession);
    }

    // Audit log
    await this.auditRepo.save(
      new AuditEvent(
        `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        'TRANSACTION_CREATED',
        dto.cashierId,
        dto.cashierName,
        {
          transactionId: transaction.id,
          ticketNumber: transaction.ticketNumber,
          plate: transaction.plateNumber,
          category: transaction.categoryCode,
          amount: transaction.amountDue,
          paymentMethod: transaction.paymentMethod,
          laneId: transaction.laneId
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
      qrCodeData: transaction.qrCodeData
    };
  }
}
