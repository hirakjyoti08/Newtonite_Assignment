import { useEffect, useRef } from 'react';
import type { SSEEvent } from '@shared/types';

export function useSSE(url: string, onMessage: (event: SSEEvent) => void, enabled: boolean = true) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);

  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    const fullUrl = `${url}?token=${token}`;
    
    const eventSource = new EventSource(fullUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        onMessageRef.current(data);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection error, reconnecting...');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url, enabled]);
}