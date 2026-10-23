import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../server/src/app.ts';
import { seedDatabase } from '../../server/src/infrastructure/persistence/SeedData.ts';
import {
  parseHikvisionPayload,
  mapVehicleTypeToCategory,
  cleanHikvisionPlate
} from '../../server/src/infrastructure/hikvision/HikvisionWebhookParser.ts';

describe('Hikvision Smart IPC LPR & Webhook Integration Tests', () => {
  let appInstance: ReturnType<typeof createApp>;

  beforeEach(async () => {
    appInstance = createApp();
    await seedDatabase(
      appInstance.repos.userRepo,
      appInstance.repos.tariffRepo,
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );
  });

  describe('Hikvision Payload Parser & Normalizer', () => {
    it('should cleanly normalize plate numbers with spaces or missing dashes', () => {
      expect(cleanHikvisionPlate('AB 864 HM')).toBe('AB-864-HM');
      expect(cleanHikvisionPlate('AB864HM')).toBe('AB-864-HM');
      expect(cleanHikvisionPlate('GB4512AZ')).toBe('GB-4512-AZ');
      expect(cleanHikvisionPlate('GB 2345 AF')).toBe('GB-2345-AF');
    });

    it('should map vehicle types to official AREZKI BISSAU categories', () => {
      expect(mapVehicleTypeToCategory('moto')).toBe('CAT1');
      expect(mapVehicleTypeToCategory('taxi')).toBe('CAT1');
      expect(mapVehicleTypeToCategory('car')).toBe('CAT2');
      expect(mapVehicleTypeToCategory('SUV')).toBe('CAT2');
      expect(mapVehicleTypeToCategory('bus')).toBe('CAT3');
      expect(mapVehicleTypeToCategory('minibus')).toBe('CAT3');
      expect(mapVehicleTypeToCategory('truck')).toBe('CAT4');
      expect(mapVehicleTypeToCategory('semi-trailer')).toBe('CAT5');
      expect(mapVehicleTypeToCategory('train-routier')).toBe('CAT5');
    });

    it('should parse standard Hikvision PlateResult JSON payload', () => {
      const jsonPayload = {
        ipAddress: '192.168.1.64',
        channelID: 1,
        dateTime: '2026-10-22T18:00:00.000Z',
        PlateResult: {
          plateNumber: 'AB-864-HM',
          confidence: 98,
          carType: 'SUV',
          laneNum: 1,
          pictureData: 'data:image/jpeg;base64,/9j/fakecarimage'
        }
      };

      const parsed = parseHikvisionPayload(jsonPayload);
      expect(parsed).not.toBeNull();
      expect(parsed?.plateNumber).toBe('AB-864-HM');
      expect(parsed?.confidence).toBe(98);
      expect(parsed?.categoryCode).toBe('CAT2');
      expect(parsed?.laneId).toBe('VOIE-01');
      expect(parsed?.vehicleImageUrl).toBe('data:image/jpeg;base64,/9j/fakecarimage');
    });

    it('should parse Hikvision ISAPI XML EventNotificationAlert payload', () => {
      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <ipAddress>192.168.1.64</ipAddress>
  <channelID>1</channelID>
  <dateTime>2026-10-22T18:15:00Z</dateTime>
  <eventType>ANPR</eventType>
  <ANPR>
    <licensePlate>GB-4512-AZ</licensePlate>
    <confidenceLevel>96</confidenceLevel>
    <vehicleType>car</vehicleType>
  </ANPR>
</EventNotificationAlert>`;

      const parsed = parseHikvisionPayload(xmlPayload);
      expect(parsed).not.toBeNull();
      expect(parsed?.plateNumber).toBe('GB-4512-AZ');
      expect(parsed?.confidence).toBe(96);
      expect(parsed?.categoryCode).toBe('CAT2');
      expect(parsed?.laneId).toBe('VOIE-01');
    });

    it('should parse Dahua ANPR camera payload', () => {
      const dahuaPayload = {
        Picture: {
          Plate: {
            PlateNumber: 'AB-864-HM',
            Confidence: 97,
            VehicleType: 'car'
          },
          SnapImage: 'data:image/jpeg;base64,/9j/dahuaimg'
        },
        channelID: 1
      };

      const parsed = parseHikvisionPayload(dahuaPayload);
      expect(parsed).not.toBeNull();
      expect(parsed?.plateNumber).toBe('AB-864-HM');
      expect(parsed?.confidence).toBe(97);
      expect(parsed?.categoryCode).toBe('CAT2');
      expect(parsed?.laneId).toBe('VOIE-01');
      expect(parsed?.vehicleImageUrl).toBe('data:image/jpeg;base64,/9j/dahuaimg');
    });

    it('should parse Axis / Generic ANPR JSON payload', () => {
      const axisPayload = {
        LicensePlate: 'GB-4512-AZ',
        confidence: 94,
        vehicleType: 'bus',
        laneId: 'VOIE-02'
      };

      const parsed = parseHikvisionPayload(axisPayload);
      expect(parsed).not.toBeNull();
      expect(parsed?.plateNumber).toBe('GB-4512-AZ');
      expect(parsed?.confidence).toBe(94);
      expect(parsed?.categoryCode).toBe('CAT3');
      expect(parsed?.laneId).toBe('VOIE-02');
    });
  });

  describe('Hikvision API Endpoints & Simulation', () => {
    it('should process webhook JSON simulation and return valid ticket & tariff', async () => {
      const server = appInstance.app.listen(0);
      const address = server.address() as any;
      const port = address.port;

      try {
        const response = await fetch(`http://localhost:${port}/api/toll/hikvision-webhook/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plateNumber: 'AB-864-HM',
            vehicleType: 'SUV',
            confidence: 98,
            laneId: 'VOIE-01'
          })
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.ResponseStatus).toBe('OK');
        expect(data.detection).toBeDefined();
        expect(data.detection.plateNumber).toBe('AB-864-HM');
        expect(data.detection.categoryCode).toBe('CAT2');
        expect(data.detection.amountDue).toBe(500);
        expect(data.detection.ticketNumber).toMatch(/^TK-/);

        // Check latest detection retrieval
        const latestRes = await fetch(`http://localhost:${port}/api/toll/hikvision-latest?laneId=VOIE-01`);
        expect(latestRes.status).toBe(200);
        const latestData = await latestRes.json();
        expect(latestData.detection).toBeDefined();
        expect(latestData.detection.plateNumber).toBe('AB-864-HM');

        // Check status endpoint
        const statusRes = await fetch(`http://localhost:${port}/api/toll/hikvision-status`);
        expect(statusRes.status).toBe(200);
        const statusData = await statusRes.json();
        expect(statusData.status).toBe('LISTENING');
        expect(statusData.supportedModel).toContain('DS-2CD4626FWD-IZHS/P');

        // Check universal camera endpoints alias
        const universalLatestRes = await fetch(`http://localhost:${port}/api/toll/camera-latest?laneId=VOIE-01`);
        expect(universalLatestRes.status).toBe(200);
        const universalStatusRes = await fetch(`http://localhost:${port}/api/toll/camera-status`);
        expect(universalStatusRes.status).toBe(200);
        const universalStatusData = await universalStatusRes.json();
        expect(universalStatusData.supportedVendors).toContain('Dahua (ANPR/ITC)');
        expect(universalStatusData.serverIps).toBeDefined();
        expect(Array.isArray(universalStatusData.serverIps)).toBe(true);

        // Check dynamic network-info endpoint (no hardcoded IP)
        const netRes = await fetch(`http://localhost:${port}/api/toll/network-info`);
        expect(netRes.status).toBe(200);
        const netData = await netRes.json();
        expect(netData.serverIps.length).toBeGreaterThan(0);
        expect(netData.webhookUrls[0]).toContain('/api/toll/camera-webhook');
      } finally {
        server.close();
      }
    });

    it('should process direct Hikvision webhook POST with XML body', async () => {
      const server = appInstance.app.listen(0);
      const address = server.address() as any;
      const port = address.port;

      try {
        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert version="2.0">
  <ipAddress>192.168.1.64</ipAddress>
  <channelID>1</channelID>
  <ANPR>
    <licensePlate>GB-2345-AF</licensePlate>
    <confidenceLevel>95</confidenceLevel>
    <vehicleType>taxi</vehicleType>
  </ANPR>
</EventNotificationAlert>`;

        const response = await fetch(`http://localhost:${port}/api/toll/hikvision-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: xmlBody
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.ResponseStatus).toBe('OK');
        expect(data.detection.plateNumber).toBe('GB-2345-AF');
        expect(data.detection.categoryCode).toBe('CAT1'); // Taxi Bissau -> CAT1
        expect(data.detection.amountDue).toBe(250);
      } finally {
        server.close();
      }
    });
  });
});
