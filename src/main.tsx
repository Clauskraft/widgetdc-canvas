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
    (window as any).useCanvasStore = useCanvasStore;
    (window as any).__WIDGETDC_CANVAS_BUILD__ = DEBUG_BUILD_STAMP;
    document.title = `WidgeTDC Canvas ${DEBUG_BUILD_STAMP}`;
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <AppShell />
    </StrictMode>,
  );
}
