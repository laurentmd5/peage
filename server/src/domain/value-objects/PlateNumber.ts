export class PlateNumber {
  private readonly _value: string;
  private readonly _confidence: number;

  /**
   * Expression régulière officielle pour immatriculation sénégalaise région Dakar (DK) :
   * Format standard : DK-XXXX-YY ou DK-XXXX-Y (avec tirets ou espaces optionnels)
   * Exemples : DK-1234-AA, DK-5678-BB, DK-9012-C
   */
  static readonly SENEGAL_DK_REGEX = /^DK[- ]?(\d{3,4})[- ]?([A-Z]{1,2})$/i;

  /**
   * Expression régulière pour immatriculation Guinée-Bissau (GB) pour le client AREZKI BISSAU :
   * Format standard : GB-XXXX-YY ou GB-XXXX-Y
   * Exemples : GB-2345-AF, GB-8765-BB
   */
  static readonly GUINEA_BISSAU_REGEX = /^GB[- ]?(\d{3,4})[- ]?([A-Z]{1,2})$/i;

  constructor(value: string, confidence: number = 95) {
    if (!value || typeof value !== 'string') {
      throw new Error(`Plaque d'immatriculation invalide: ${value}`);
    }

    let cleaned = value.trim().toUpperCase();
    if (!cleaned || cleaned.length < 3) {
      throw new Error(`Plaque d'immatriculation invalide: ${value}`);
    }

    if (confidence < 0 || confidence > 100) {
      throw new Error(`Score de confiance invalide: ${confidence}. Doit être entre 0 et 100.`);
    }

    // Normalisation canonique au format officiel sénégalais DK (DK-XXXX-YY)
    const dkMatch = cleaned.match(PlateNumber.SENEGAL_DK_REGEX);
    if (dkMatch) {
      cleaned = `DK-${dkMatch[1]}-${dkMatch[2].toUpperCase()}`;
    } else {
      // Normalisation au format officiel Guinée-Bissau GB (GB-XXXX-YY)
      const gbMatch = cleaned.match(PlateNumber.GUINEA_BISSAU_REGEX);
      if (gbMatch) {
        cleaned = `GB-${gbMatch[1]}-${gbMatch[2].toUpperCase()}`;
      } else {
        // Si saisie simplifiée de type 1234-AA ou 1234AA sans préfixe
        const noPrefixMatch = cleaned.match(/^(\d{3,4})[- ]?([A-Z]{1,2})$/i);
        if (noPrefixMatch) {
          cleaned = `DK-${noPrefixMatch[1]}-${noPrefixMatch[2].toUpperCase()}`;
        }
      }
    }

    this._value = cleaned;
    this._confidence = Math.round(confidence);
  }

  get value(): string {
    return this._value;
  }

  get confidence(): number {
    return this._confidence;
  }

  /**
   * Vérifie si la plaque respecte la norme d'immatriculation sénégalaise de Dakar (DK)
   */
  get isSenegalDk(): boolean {
    return PlateNumber.SENEGAL_DK_REGEX.test(this._value);
  }

  /**
   * Vérifie si la plaque respecte la norme d'immatriculation Guinée-Bissau (GB)
   */
  get isGuineaBissau(): boolean {
    return PlateNumber.GUINEA_BISSAU_REGEX.test(this._value);
  }

  static isValidSenegalDk(value: string): boolean {
    if (!value) return false;
    return PlateNumber.SENEGAL_DK_REGEX.test(value.trim()) || /^(\d{3,4})[- ]?([A-Z]{1,2})$/i.test(value.trim());
  }

  static isValidGuineaBissau(value: string): boolean {
    if (!value) return false;
    return PlateNumber.GUINEA_BISSAU_REGEX.test(value.trim());
  }

  /**
   * Génère une plaque sénégalaise DK aléatoire réaliste
   */
  static generateRandomSenegalDk(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    const lettersPool = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AK', 'AL', 'BB', 'BC', 'BD', 'BE', 'BF', 'CC', 'DK'];
    const suffix = lettersPool[Math.floor(Math.random() * lettersPool.length)];
    return `DK-${num}-${suffix}`;
  }

  /**
   * Génère une plaque Guinée-Bissau GB aléatoire réaliste pour AREZKI BISSAU
   */
  static generateRandomGuineaBissau(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    const lettersPool = ['AB', 'AC', 'AZ', 'BB', 'BC', 'BZ', 'CC', 'GB'];
    const suffix = lettersPool[Math.floor(Math.random() * lettersPool.length)];
    return `GB-${num}-${suffix}`;
  }

  toString(): string {
    return this._value;
  }

  equals(other: PlateNumber): boolean {
    return this._value === other.value;
  }
}
