export interface TariffHistoryEntry {
  rate: number;
  effectiveDate: Date;
  changedBy: string;
  reason?: string;
}

export class TariffCategory {
  readonly code: string;
  label: string;
  private _currentRate: number;
  private _isActive: boolean;
  private _history: TariffHistoryEntry[];

  constructor(
    code: string,
    label: string,
    rate: number,
    isActive: boolean = true,
    history: TariffHistoryEntry[] = []
  ) {
    if (!code || code.trim().length === 0) {
      throw new Error('Le code de catégorie est obligatoire');
    }
    if (!label || label.trim().length === 0) {
      throw new Error('Le libellé de catégorie est obligatoire');
    }
    if (rate < 0) {
      throw new Error('Le tarif ne peut pas être négatif');
    }

    this.code = code.trim().toUpperCase();
    this.label = label.trim();
    this._currentRate = rate;
    this._isActive = isActive;
    this._history = history.length > 0 ? [...history] : [
      {
        rate,
        effectiveDate: new Date(),
        changedBy: 'SYSTEM',
        reason: 'Tarif initial'
      }
    ];
  }

  get currentRate(): number {
    return this._currentRate;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get history(): ReadonlyArray<TariffHistoryEntry> {
    return [...this._history];
  }

  updateRate(newRate: number, changedBy: string, reason?: string): void {
    if (newRate < 0) {
      throw new Error('Le tarif ne peut pas être négatif');
    }
    if (!changedBy) {
      throw new Error("L'identifiant de l'auteur de modification est requis");
    }

    this._currentRate = newRate;
    this._history.push({
      rate: newRate,
      effectiveDate: new Date(),
      changedBy,
      reason: reason || 'Mise à jour tarifaire'
    });
  }

  toggleActive(): void {
    this._isActive = !this._isActive;
  }

  setActive(active: boolean): void {
    this._isActive = active;
  }

  toJSON() {
    return {
      code: this.code,
      label: this.label,
      currentRate: this._currentRate,
      isActive: this._isActive,
      history: this._history
    };
  }
}
