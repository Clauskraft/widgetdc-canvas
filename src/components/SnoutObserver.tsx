import { useEffect } from 'react';
import { bindSnoutObserverToWebSocket } from '../lib/snout';
import { canvasDocBindings } from '../store/crdt';

function resolveSnoutWebSocketUrl(): string | null {
  const explicitUrl = import.meta.env.VITE_SNOUT_WS_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/rlm/stream`;
}

export function SnoutObserver() {
  useEffect(() => {
    const url = resolveSnoutWebSocketUrl();
    if (!url) {
      return undefined;
    }

    return bindSnoutObserverToWebSocket(canvasDocBindings, url);
  }, []);

  return null;
}
