"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string | null) => void;
}

export function Turnstile({ siteKey, onToken }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const handleToken = useCallback((token: string) => {
    onToken(token);
  }, [onToken]);

  const handleError = useCallback(() => {
    onToken(null);
  }, [onToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      if (window.turnstile && container) {
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          callback: handleToken,
          "error-callback": handleError,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, handleToken, handleError]);

  return <div ref={containerRef} className="flex justify-center" />;
}
