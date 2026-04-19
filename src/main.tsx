import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppShell, DEBUG_BUILD_STAMP } from './AppShell';
import { useCanvasStore } from './store/canvasStore';
import './index.css';
// UC5: substrate-cartography theme tokens (CSS custom properties)
import './theme/substrate-cartography.css';

const container = document.getElementById('root');

if (container) {
  if (import.meta.env.DEV) {
    // FIX (P2): Use a typed Window extension rather than (window as any) to
    // eliminate implicit any. These assignments are tree-shaken from production
    // builds by Vite because import.meta.env.DEV is statically false.
    type DevWindow = Window & { __WDC_STORE__?: unknown; __WDC_BUILD__?: string };
    (window as DevWindow).__WDC_STORE__ = useCanvasStore;
    (window as DevWindow).__WDC_BUILD__ = DEBUG_BUILD_STAMP;
    document.title = `WidgeTDC Canvas ${DEBUG_BUILD_STAMP}`;
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <AppShell />
    </StrictMode>,
  );
}
