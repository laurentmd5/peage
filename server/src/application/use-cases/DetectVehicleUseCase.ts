import { ITariffRepository } from '../../domain/repositories/ITariffRepository.ts';
import { Ticket } from '../../domain/value-objects/Ticket.ts';
import { PlateNumber } from '../../domain/value-objects/PlateNumber.ts';
import { DetectVehicleResponseDTO } from '../dtos/TransactionDTO.ts';

export class DetectVehicleUseCase {
  static readonly DEMO_PLATES: string[] = [
    // 100% Guinée-Bissau (Client AREZKI BISSAU)
    'GB-2345-AF',
    'GB-8765-BZ',
    'GB-4512-AZ',
    'GB-9021-BB',
    'GB-1122-CX',
    'GB-6789-DX',
    'GB-3344-EZ',
    'GB-5566-FX',
    'GB-7788-GA',
    'GB-9900-HB',
    'GB-1357-BA',
    'GB-2468-BC'
  ];

  // Visual vehicle silhouettes/photos for realistic demo (5 Catégories AREZKI BISSAU + Aliases)
  static readonly VEHICLE_IMAGES: Record<string, string> = {
    CAT1: '/images/taxi.png', // Motos, Tricycles, Taxis
    CAT2: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80', // Voitures & Pick-up
    CAT3: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=80', // Canter, Bus, Mini-camions
    CAT4: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=500&auto=format&fit=crop&q=80', // Camions 7t-20t
    CAT5: 'https://images.unsplash.com/photo-1586191582056-a94f31c26027?w=500&auto=format&fit=crop&q=80', // Semi-remorques >20t
    EXEMPT: 'https://images.unsplash.com/photo-1587740896339-968561b8c41e?w=500&auto=format&fit=crop&q=80',
    // Compatibility aliases
    MOTO: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    VL: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80',
    TAXI: '/images/taxi.png',
    MINIBUS: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=500&auto=format&fit=crop&q=80',
    BUS: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=80',
    UTIL: 'https://images.unsplash.com/photo-1586191582056-a94f31c26027?w=500&auto=format&fit=crop&q=80',
    PL: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=500&auto=format&fit=crop&q=80',
    SPECIAL: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500&auto=format&fit=crop&q=80'
  };

  constructor(private readonly tariffRepo: ITariffRepository) {}

  async execute(laneId: string = 'CAISSE-01', forcedPlate?: string, forcedCategory?: string): Promise<DetectVehicleResponseDTO> {
    const rawPlate = forcedPlate || DetectVehicleUseCase.DEMO_PLATES[Math.floor(Math.random() * DetectVehicleUseCase.DEMO_PLATES.length)];
    const confidence = Math.floor(85 + Math.random() * 15); // 85% to 99%
    const plate = new PlateNumber(rawPlate, confidence);

    const categories = await this.tariffRepo.getAll();
    const activeCategories = categories.filter(c => c.isActive);

    if (activeCategories.length === 0) {
      throw new Error('Aucune catégorie de tarif active disponible');
    }

    // Resolve legacy aliases to the 5 official categories
    let normalizedForced = forcedCategory?.toUpperCase();
    if (normalizedForced === 'TAXI' || normalizedForced === 'MOTO') normalizedForced = 'CAT1';
    if (normalizedForced === 'VL') normalizedForced = 'CAT2';
    if (normalizedForced === 'BUS' || normalizedForced === 'MINIBUS') normalizedForced = 'CAT3';
    if (normalizedForced === 'PL' || normalizedForced === 'UTIL') normalizedForced = 'CAT4';

    let selectedCat = normalizedForced
      ? (activeCategories.find(c => c.code === normalizedForced) || activeCategories.find(c => c.code === forcedCategory?.toUpperCase()))
      : undefined;

    if (!selectedCat) {
      // Pick random category weighted toward standard vehicles (CAT1, CAT2)
      const weights = ['CAT1', 'CAT2', 'CAT2', 'CAT2', 'CAT3', 'CAT4', 'CAT5'];
      const pickCode = weights[Math.floor(Math.random() * weights.length)];
      selectedCat = activeCategories.find(c => c.code === pickCode) || activeCategories[0];
    }

    const ticket = Ticket.generate(laneId, plate.value, selectedCat.code, selectedCat.currentRate);

    return {
      plateNumber: plate.value,
      confidence: plate.confidence,
      categoryCode: selectedCat.code,
      categoryLabel: selectedCat.label,
      amountDue: selectedCat.currentRate,
      ticketNumber: ticket.ticketNumber,
      qrCodeData: ticket.qrCodeData,
      detectedAt: new Date(),
      vehicleImageUrl: DetectVehicleUseCase.VEHICLE_IMAGES[selectedCat.code] || DetectVehicleUseCase.VEHICLE_IMAGES.VL
    };
  }
}
