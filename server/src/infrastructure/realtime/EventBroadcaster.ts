import { Response } from 'express';

export class EventBroadcaster {
  private static clients: Response[] = [];

  static subscribe(res: Response): void {
    this.clients.push(res);
  }

  static unsubscribe(res: Response): void {
    this.clients = this.clients.filter(c => c !== res);
  }

  static broadcast(eventName: string, data: any): void {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(client => {
      try {
        client.write(payload);
      } catch (err) {
        // client likely disconnected
      }
    });
  }
}
