export enum PaymentMethod {
  ESPECES = 'ESPECES',
  CARTE = 'CARTE',
  WAVE = 'WAVE',
  ORANGE_MONEY = 'ORANGE_MONEY',
  RFID = 'RFID'
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.ESPECES]: 'Espèces',
  [PaymentMethod.CARTE]: 'Carte Bancaire',
  [PaymentMethod.WAVE]: 'Wave Mobile Money',
  [PaymentMethod.ORANGE_MONEY]: 'Orange Money',
  [PaymentMethod.RFID]: 'Badge / Télépéage RFID'
};
