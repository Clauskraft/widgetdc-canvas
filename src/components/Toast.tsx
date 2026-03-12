import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContextType {
  toast: (type: Toast['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-16 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl border text-sm animate-slide-up ${
              t.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-200' :
              t.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-200' :
              'bg-blue-900/90 border-blue-700 text-blue-200'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={16} />}
            {t.type === 'error' && <XCircle size={16} />}
            {t.type === 'info' && <Info size={16} />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
