import { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const DEFAULT_DURATIONS = {
  success: 2800,
  info:    3000,
  warn:    4000,
  warning: 4000,
  error:   5000, // errors need reading time
};

const TYPE_STYLES = {
  success: { icon: CheckCircle2, color: "text-ok" },
  error: { icon: AlertCircle, color: "text-err" },
  warn: { icon: AlertTriangle, color: "text-warn" },
  warning: { icon: AlertTriangle, color: "text-warn" },
  info: { icon: Info, color: "text-accent" },
};

let toastId = 0;

// Paper toast: bordered card with the one overlay shadow. Errors are
// assertive (role="alert"); everything else is announced politely by the
// status region that contains it.
function ToastItem({ message, type, onDismiss }) {
  const { icon: Icon, color } = TYPE_STYLES[type] || TYPE_STYLES.info;
  return (
    <div
      className="pointer-events-auto flex min-w-[280px] max-w-md items-start gap-3 rounded-2xl border border-line bg-card py-2 pl-4 pr-1 shadow-card-elevated"
    >
      <Icon aria-hidden="true" className={`mt-3 size-5 shrink-0 ${color}`} />
      <p aria-hidden="true" className="min-w-0 flex-1 py-3 text-small font-medium text-fg">
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg-3 transition-colors duration-150 ease-out hover:bg-canvas hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "success", duration) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      const finalDuration = duration ?? DEFAULT_DURATIONS[type] ?? 3000;
      timersRef.current[id] = setTimeout(() => removeToast(id), finalDuration);
      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Bottom-right stack with proper gap and mobile bottom-safe padding */}
      {/* Visible stack: not a live region, so nothing is announced twice. The
          message text is aria-hidden here; the always-mounted sr-only regions
          below carry what screen readers announce, once per toast. */}
      <div
        data-paper-toasts=""
        className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
      <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
        {toasts
          .filter((t) => t.type !== "error")
          .map((t) => (
            <p key={t.id}>{t.message}</p>
          ))}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="false" className="sr-only">
        {toasts
          .filter((t) => t.type === "error")
          .map((t) => (
            <p key={t.id}>{t.message}</p>
          ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
