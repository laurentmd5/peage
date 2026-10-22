import { TariffHistoryEntry } from '../../domain/entities/TariffCategory.ts';

export interface TariffCategoryDTO {
  code: string;
  label: string;
  currentRate: number;
  isActive: boolean;
  history: ReadonlyArray<TariffHistoryEntry>;
}

export interface UpdateTariffRequestDTO {
  code: string;
  newRate: number;
  changedBy: string;
  reason?: string;
}

export interface CreateTariffRequestDTO {
  code: string;
  label: string;
  rate: number;
}
