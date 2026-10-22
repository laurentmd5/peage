import { TariffCategory } from '../entities/TariffCategory.ts';

export interface ITariffRepository {
  getAll(): Promise<TariffCategory[]>;
  findByCode(code: string): Promise<TariffCategory | null>;
  save(category: TariffCategory): Promise<void>;
  delete(code: string): Promise<boolean>;
}
