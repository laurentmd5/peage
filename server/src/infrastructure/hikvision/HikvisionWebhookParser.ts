/**
 * Hikvision Smart IPC LPR Webhook & ISAPI Event Parser
 * Compatible with Hikvision DS-2CD4626FWD-IZHS/P Road Traffic & ANPR Bullet Cameras
 */

export interface ParsedHikvisionDetection {
  plateNumber: string;
  confidence: number;
  vehicleType: string;
  categoryCode: 'CAT1' | 'CAT2' | 'CAT3' | 'CAT4' | 'CAT5';
  laneId: string;
  vehicleImageUrl?: string;
  plateImageUrl?: string;
  ipAddress?: string;
  dateTime?: string;
  rawPayload?: any;
}

/**
 * Maps vehicle silhouettes and Hikvision carType strings to official AREZKI BISSAU toll categories
 */
export function mapVehicleTypeToCategory(vehicleType?: string): 'CAT1' | 'CAT2' | 'CAT3' | 'CAT4' | 'CAT5' {
  if (!vehicleType) return 'CAT2';
  const v = vehicleType.toLowerCase().trim();

  // Cat 1: Motos, Tricycles, Taxis
  if (
    v.includes('moto') ||
    v.includes('bike') ||
    v.includes('tricycle') ||
    v.includes('scooter') ||
    v.includes('taxi')
  ) {
    return 'CAT1';
  }

  // Cat 3: Canter, Minibus, Buses
  if (
    v.includes('bus') ||
    v.includes('minibus') ||
    v.includes('canter') ||
    v.includes('van-bus') ||
    v.includes('coach')
  ) {
    return 'CAT3';
  }

  // Cat 5: Heavy articulated vehicles, semi-trailers (> 20t)
  if (
    v.includes('semi') ||
    v.includes('trailer') ||
    v.includes('articulated') ||
    v.includes('train-routier') ||
    v.includes('container')
  ) {
    return 'CAT5';
  }

  // Cat 4: Rigid trucks, 2-axle trucks (7t to 20t)
  if (
    v.includes('truck') ||
    v.includes('camion') ||
    v.includes('rigid') ||
    v.includes('lorry') ||
    v.includes('heavy')
  ) {
    return 'CAT4';
  }

  // Cat 2: Standard cars, SUVs, pickups, vans
  return 'CAT2';
}

/**
 * Formats a raw license plate string to clean standardized format
 * e.g. "AB 864 HM" -> "AB-864-HM", "GB4512AZ" -> "GB-4512-AZ"
 */
export function cleanHikvisionPlate(rawPlate: string): string {
  if (!rawPlate) return '';
  const clean = rawPlate.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-');
  
  // Format GB plates if missing dashes: GB4512AZ -> GB-4512-AZ
  const gbMatch = clean.replace(/-/g, '').match(/^(GB)(\d{3,4})([A-Z]{1,2})$/);
  if (gbMatch) {
    return `GB-${gbMatch[2]}-${gbMatch[3]}`;
  }

  // Format International plates if missing dashes: AB864HM -> AB-864-HM
  const intlMatch = clean.replace(/-/g, '').match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
  if (intlMatch) {
    return `${intlMatch[1]}-${intlMatch[2]}-${intlMatch[3]}`;
  }

  return clean;
}

/**
 * Main parser: extracts plate, vehicle type, confidence, and image data from Hikvision JSON or XML
 */
export function parseHikvisionPayload(body: any): ParsedHikvisionDetection | null {
  if (!body) return null;

  let plate = '';
  let conf = 95;
  let vType = 'car';
  let lane = 'VOIE-01';
  let ip = '192.168.1.64';
  let dateTime = new Date().toISOString();
  let vehicleImg: string | undefined;
  let plateImg: string | undefined;

  // 1. Parsing if body is XML string (ISAPI EventNotificationAlert format)
  if (typeof body === 'string') {
    const plateMatch = body.match(/<(?:licensePlate|plateNumber)>([^<]+)<\/(?:licensePlate|plateNumber)>/i);
    if (plateMatch) plate = plateMatch[1].trim();

    const confMatch = body.match(/<(?:confidenceLevel|confidence)>([^<]+)<\/(?:confidenceLevel|confidence)>/i);
    if (confMatch) conf = parseInt(confMatch[1], 10) || 95;

    const typeMatch = body.match(/<(?:vehicleType|carType)>([^<]+)<\/(?:vehicleType|carType)>/i);
    if (typeMatch) vType = typeMatch[1].trim();

    const laneMatch = body.match(/<(?:laneId|channelID|laneNum)>([^<]+)<\/(?:laneId|channelID|laneNum)>/i);
    if (laneMatch) {
      const num = laneMatch[1].trim();
      lane = num.startsWith('VOIE-') ? num : `VOIE-0${num}`;
    }

    const ipMatch = body.match(/<ipAddress>([^<]+)<\/ipAddress>/i);
    if (ipMatch) ip = ipMatch[1].trim();

    const dateMatch = body.match(/<dateTime>([^<]+)<\/dateTime>/i);
    if (dateMatch) dateTime = dateMatch[1].trim();

    // Check base64 picture data in XML if present
    const picMatch = body.match(/<(?:pictureData|vehiclePicture|picture)>([^<]+)<\/(?:pictureData|vehiclePicture|picture)>/i);
    if (picMatch && picMatch[1].length > 50) {
      vehicleImg = picMatch[1].startsWith('data:') ? picMatch[1] : `data:image/jpeg;base64,${picMatch[1]}`;
    }
  }
  // 2. Parsing if body is JSON object
  else if (typeof body === 'object') {
    // Check Hikvision standard structures (PlateResult or EventNotificationAlert)
    const pr = body.PlateResult || body.plateResult || body;
    const alert = body.EventNotificationAlert?.ANPR || body.EventNotificationAlert || {};

    // Check Dahua standard structures (Picture.Plate or TrafficCar)
    const dahuaPlate = body.Picture?.Plate?.PlateNumber || body.TrafficCar?.PlateNumber || body.Plate?.PlateNumber;
    const dahuaConf = body.Picture?.Plate?.Confidence || body.TrafficCar?.Confidence;
    const dahuaType = body.TrafficCar?.VehicleType || body.Picture?.Plate?.VehicleType;

    // Check Axis / Generic LPR structures (LicensePlate, plate, Plate)
    const genericPlate = body.LicensePlate || body.licensePlate || body.Plate || body.plate;

    plate =
      pr.plateNumber ||
      pr.licensePlate ||
      alert.licensePlate ||
      alert.plateNumber ||
      dahuaPlate ||
      genericPlate ||
      body.plateNumber ||
      '';

    conf =
      pr.confidence ||
      pr.confidenceLevel ||
      alert.confidenceLevel ||
      dahuaConf ||
      body.confidence ||
      body.Confidence ||
      95;

    vType =
      pr.carType ||
      pr.vehicleType ||
      alert.vehicleType ||
      dahuaType ||
      body.vehicleType ||
      body.carType ||
      'car';

    ip = body.ipAddress || pr.ipAddress || body.ip || '192.168.1.64';
    dateTime = body.dateTime || pr.dateTime || body.time || new Date().toISOString();

    const rawLane = pr.laneNum || pr.channelID || body.channelID || body.laneId || body.lane || 1;
    lane = typeof rawLane === 'string' && rawLane.startsWith('VOIE-') ? rawLane : `VOIE-0${rawLane}`;

    // Images (supports Hikvision, Dahua, Axis, and generic base64/URL fields)
    const rawVehicleImg =
      pr.vehicleImageUrl ||
      pr.pictureData ||
      alert.vehiclePicture ||
      body.Picture?.SnapImage ||
      body.vehicleImageUrl ||
      body.vehicleImage ||
      body.snapshotDataUrl;

    if (rawVehicleImg) {
      vehicleImg = rawVehicleImg.startsWith('data:') || rawVehicleImg.startsWith('http')
        ? rawVehicleImg
        : `data:image/jpeg;base64,${rawVehicleImg}`;
    }

    const rawPlateImg =
      pr.plateImageUrl ||
      pr.platePictureData ||
      alert.platePicture ||
      body.Picture?.PlateImage ||
      body.plateImageUrl ||
      body.plateImage;

    if (rawPlateImg) {
      plateImg = rawPlateImg.startsWith('data:') || rawPlateImg.startsWith('http')
        ? rawPlateImg
        : `data:image/jpeg;base64,${rawPlateImg}`;
    }
  }

  if (!plate) return null;

  const finalPlate = cleanHikvisionPlate(plate);
  const categoryCode = mapVehicleTypeToCategory(vType);

  return {
    plateNumber: finalPlate,
    confidence: Math.min(100, Math.max(50, conf)),
    vehicleType: vType,
    categoryCode,
    laneId: lane,
    vehicleImageUrl: vehicleImg,
    plateImageUrl: plateImg,
    ipAddress: ip,
    dateTime,
    rawPayload: body
  };
}
