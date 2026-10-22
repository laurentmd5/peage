import { ITariffRepository } from '../../domain/repositories/ITariffRepository.ts';
import { TariffCategory } from '../../domain/entities/TariffCategory.ts';

export class InMemoryTariffRepository implements ITariffRepository {
  private categories: Map<string, TariffCategory> = new Map();

  async getAll(): Promise<TariffCategory[]> {
    return Array.from(this.categories.values());
  }

  async findByCode(code: string): Promise<TariffCategory | null> {
    const cat = this.categories.get(code.toUpperCase().trim());
    return cat || null;
  }

  async save(category: TariffCategory): Promise<void> {
    this.categories.set(category.code.toUpperCase().trim(), category);
  }

  async delete(code: string): Promise<boolean> {
    return this.categories.delete(code.toUpperCase().trim());
  }
}
