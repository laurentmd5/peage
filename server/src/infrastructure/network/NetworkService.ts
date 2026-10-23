import os from 'os';

export interface NetworkInfo {
  serverIps: string[];
  primaryIp: string;
  port: number;
  webhookUrls: string[];
}

export class NetworkService {
  /**
   * Scanne dynamiquement les cartes réseau du serveur pour extraire
   * toutes les adresses IPv4 locales réelles (Wi-Fi, Ethernet, LAN).
   * Aucune adresse n'est codée en dur.
   */
  static getNetworkInfo(port: number = 3001): NetworkInfo {
    const interfaces = os.networkInterfaces();
    const serverIps: string[] = [];

    // Priorité à une variable d'environnement si l'administrateur souhaite forcer une interface
    if (process.env.SERVER_IP) {
      serverIps.push(process.env.SERVER_IP);
    }

    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        // Ignorer les adresses internes (loopback 127.0.0.1) et les IPv6
        if (net.family === 'IPv4' && !net.internal) {
          if (!serverIps.includes(net.address)) {
            serverIps.push(net.address);
          }
        }
      }
    }

    if (serverIps.length === 0) {
      serverIps.push('127.0.0.1');
    }

    const primaryIp = serverIps[0];
    const webhookUrls = serverIps.map(ip => `http://${ip}:${port}/api/toll/camera-webhook`);

    return {
      serverIps,
      primaryIp,
      port,
      webhookUrls
    };
  }
}
