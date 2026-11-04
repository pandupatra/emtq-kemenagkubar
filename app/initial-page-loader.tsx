"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import lptqLogo from "@/public/logo-lptq.png";

const InitialPageReadyContext = createContext<() => void>(() => {});

export function useInitialPageReady(ready: boolean) {
  const markReady = useContext(InitialPageReadyContext);
  useEffect(() => {
    if (ready) markReady();
  }, [ready, markReady]);
}

export default function InitialPageLoader({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [exiting, setExiting] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const finish = () => setDocumentLoaded(true);
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    return () => {
      window.removeEventListener("load", finish);
    };
  }, []);

  useEffect(() => {
    if (!ready || !documentLoaded) return;
    const timer = setTimeout(() => setExiting(true), 100);
    return () => clearTimeout(timer);
  }, [ready, documentLoaded]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(timer);
  }, [exiting]);

  return (
    <InitialPageReadyContext.Provider value={markReady}>
      {loading && (
        <div
          className={`initial-page-loader${exiting ? " is-exiting" : ""}`}
          role="status"
          aria-live="polite"
        >
          <Image src={lptqLogo} alt="" width={88} height={88} preload />
          <strong>e-Maqro LPTQ Kubar</strong>
          <span className="initial-page-loader-spinner" aria-hidden="true" />
          <p>Memuat aplikasi…</p>
        </div>
      )}
      <div inert={loading || undefined}>{children}</div>
    </InitialPageReadyContext.Provider>
  );
}
