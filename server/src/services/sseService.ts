import { EventEmitter } from 'events';
import { SSEEvent } from '../shared/types';

class SSEService {
  private emitter = new EventEmitter();

  subscribe(channel: string, callback: (data: string) => void): () => void {
    this.emitter.on(channel, callback);
    return () => this.emitter.off(channel, callback);
  }

  publish(channel: string, event: SSEEvent): void {
    this.emitter.emit(channel, JSON.stringify(event));
  }
}

export const sseService = new SSEService();