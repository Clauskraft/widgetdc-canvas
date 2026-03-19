import { useEffect } from 'react';
import { WebsocketProvider } from 'y-websocket';
import { canvasDoc } from '../store/crdt';

function getCollaborationConfig(): { serverUrl: string; room: string } | null {
  const serverUrl = import.meta.env.VITE_YJS_WS_URL;
  if (!serverUrl) {
    return null;
  }

  return {
    serverUrl,
    room: import.meta.env.VITE_YJS_ROOM ?? 'widgetdc-canvas',
  };
}

export function CanvasCollaboration() {
  useEffect(() => {
    const config = getCollaborationConfig();
    if (!config) {
      return undefined;
    }

    const provider = new WebsocketProvider(config.serverUrl, config.room, canvasDoc);
    return () => provider.destroy();
  }, []);

  return null;
}
