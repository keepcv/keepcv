import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Icon } from "../icon/icon.js";
import { Button } from "./button.js";

const LINGER_MS = 6000;

export interface Toast {
  id: number;
  tone: "positive" | "critical" | "info";
  title: string;
  detail?: string;
}

const ToastContext = createContext<((toast: Omit<Toast, "id">) => void) | undefined>(undefined);

export function useToast(): (toast: Omit<Toast, "id">) => void {
  const show = useContext(ToastContext);
  if (show === undefined) throw new Error("useToast used outside ToastRegion");
  return show;
}

const TONES = {
  positive: { icon: "success", className: "border-positive/40 text-positive-text" },
  critical: { icon: "error", className: "border-critical/40 text-critical-text" },
  info: { icon: "info", className: "border-line text-text" },
} as const;

export function ToastRegion({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((held) => held.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((held) => [...held, { ...toast, id }]);
      setTimeout(() => {
        dismiss(id);
      }, LINGER_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // `polite`, not `assertive`: a write that settled is not an interruption.
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border bg-surface-raised px-3 py-2 shadow-overlay",
              TONES[toast.tone].className,
            )}
          >
            <Icon name={TONES[toast.tone].icon} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.detail === undefined ? null : (
                <p className="mt-0.5 text-xs text-text-muted">{toast.detail}</p>
              )}
            </div>
            <Button
              tone="ghost"
              size="sm"
              icon="close"
              label="Dismiss"
              onClick={() => {
                dismiss(toast.id);
              }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
