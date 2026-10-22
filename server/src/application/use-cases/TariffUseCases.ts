import { ITariffRepository } from '../../domain/repositories/ITariffRepository.ts';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { TariffCategory } from '../../domain/entities/TariffCategory.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';
import { TariffCategoryDTO, UpdateTariffRequestDTO, CreateTariffRequestDTO } from '../dtos/TariffDTO.ts';

export class TariffUseCases {
  constructor(
    private readonly tariffRepo: ITariffRepository,
    private readonly auditRepo: IAuditRepository
  ) {}

  async getAll(): Promise<TariffCategoryDTO[]> {
    const list = await this.tariffRepo.getAll();
    return list.map(c => this.mapToDTO(c));
  }

  async updateRate(dto: UpdateTariffRequestDTO, userId: string): Promise<TariffCategoryDTO> {
    const category = await this.tariffRepo.findByCode(dto.code);
    if (!category) {
      throw new Error(`Catégorie introuvable: ${dto.code}`);
    }

    const oldRate = category.currentRate;
    category.updateRate(dto.newRate, dto.changedBy, dto.reason);
    await this.tariffRepo.save(category);

    await this.auditRepo.save(
      new AuditEvent(
        `aud-tariff-${Date.now()}`,
        'TARIFF_UPDATED',
        userId,
        dto.changedBy,
        {
          code: category.code,
          oldRate,
          newRate: dto.newRate,
          reason: dto.reason
        }
      )
    );

    return this.mapToDTO(category);
  }

  async create(dto: CreateTariffRequestDTO, userId: string, username: string): Promise<TariffCategoryDTO> {
    const existing = await this.tariffRepo.findByCode(dto.code);
    if (existing) {
      throw new Error(`Une catégorie avec le code ${dto.code} existe déjà`);
    }

    const category = new TariffCategory(dto.code, dto.label, dto.rate, true);
    await this.tariffRepo.save(category);

    await this.auditRepo.save(
      new AuditEvent(
        `aud-tariff-created-${Date.now()}`,
        'TARIFF_UPDATED',
        userId,
        username,
        {
          action: 'CREATE_CATEGORY',
          code: category.code,
          rate: category.currentRate
        }
      )
    );

    return this.mapToDTO(category);
  }

  async toggleActive(code: string, userId: string, username: string): Promise<TariffCategoryDTO> {
    const category = await this.tariffRepo.findByCode(code);
    if (!category) {
      throw new Error(`Catégorie introuvable: ${code}`);
    }

    category.toggleActive();
    await this.tariffRepo.save(category);

    await this.auditRepo.save(
      new AuditEvent(
        `aud-tariff-toggle-${Date.now()}`,
        'TARIFF_UPDATED',
        userId,
        username,
        {
          code: category.code,
          isActive: category.isActive
        }
      )
    );

    return this.mapToDTO(category);
  }

  private mapToDTO(category: TariffCategory): TariffCategoryDTO {
    return {
      code: category.code,
      label: category.label,
      currentRate: category.currentRate,
      isActive: category.isActive,
      history: category.history
    };
  }
}
