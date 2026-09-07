import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { Toast } from './Toast';

export type ToastPosition = 'top' | 'bottom';

export interface ToastConfig {
  id: number;
  message: string;
  position: ToastPosition;
  actionText?: string;
  onActionPress?: () => void;
}

export interface ToastOptions {
  message: string;
  position?: ToastPosition;
  actionText?: string;
  onActionPress?: () => void;
}

export interface ToastEntry extends ToastConfig {
  exiting?: boolean;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
  position = 'bottom',
}: {
  children: ReactNode;
  position?: ToastPosition;
}) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const nextId = useRef(1);

  const showToast = useCallback(
    (options: ToastOptions) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setToasts((current) => [
        ...current,
        {
          id: nextId.current++,
          ...options,
          position: options.position ?? position,
        },
      ]);
    },
    [position]
  );

  const handleDismissStart = useCallback((id: number) => {
    setToasts((current) =>
      current.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
  }, []);

  const handleDismissed = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    setHeights((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const handleHeightChange = useCallback((id: number, height: number) => {
    setHeights((current) =>
      current[id] === height ? current : { ...current, [id]: height }
    );
  }, []);

  const frontHeightFor = (edge: ToastPosition) => {
    const active = toasts.filter((t) => !t.exiting && t.position === edge);
    return active.length ? heights[active[active.length - 1].id] : undefined;
  };

  const frontHeights: Record<ToastPosition, number | undefined> = {
    top: frontHeightFor('top'),
    bottom: frontHeightFor('bottom'),
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          index={
            toasts.filter(
              (t) => !t.exiting && t.position === toast.position && t.id > toast.id
            ).length
          }
          height={heights[toast.id]}
          frontHeight={frontHeights[toast.position]}
          onHeightChange={handleHeightChange}
          onDismissStart={handleDismissStart}
          onDismissed={handleDismissed}
        />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
