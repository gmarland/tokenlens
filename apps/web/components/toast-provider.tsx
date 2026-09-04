"use client";

import Alert from "@mui/material/Alert";
import type { AlertColor } from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Toast = {
  id: number;
  message: string;
  severity: AlertColor;
};

type ShowToast = (message: string, severity?: AlertColor) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const nextId = useRef(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = toasts[0];

  const showToast = useCallback<ShowToast>((message, severity = "info") => {
    setToasts((current) => [
      ...current,
      { id: nextId.current++, message, severity },
    ]);
  }, []);

  const closeToast = useCallback(() => {
    setToasts((current) => current.slice(1));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Snackbar
        key={toast?.id}
        open={Boolean(toast)}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        onClose={(_, reason) => {
          if (reason !== "clickaway") closeToast();
        }}
        sx={{ maxWidth: { xs: "calc(100% - 32px)", sm: 520 } }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={closeToast}
            sx={{ width: "100%", boxShadow: 6 }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within ToastProvider");
  return showToast;
}

export function ToastOnMount({
  message,
  severity = "info",
}: {
  message: string;
  severity?: AlertColor;
}) {
  const showToast = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    showToast(message, severity);
  }, [message, severity, showToast]);

  return null;
}
