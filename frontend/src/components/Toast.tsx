import { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const colors = {
    error: 'bg-red-50 border-red-300 text-red-800',
    success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`border rounded-lg p-4 shadow-lg flex items-start gap-3 animate-in slide-in-from-right ${colors[toast.type]}`}
          >
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Benachrichtigung schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
