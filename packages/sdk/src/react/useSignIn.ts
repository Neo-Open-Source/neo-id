"use client";

import { useState, useCallback } from "react";
import { useNeoIdContext } from "./context";

type SignInStatus = "idle" | "loading" | "needs_mfa" | "error" | "success";

interface SignInResponse {
  mfa_required?: boolean;
  mfa_methods?: string[];
  passkey_available?: boolean;
  email_hint?: string;
  accessToken?: string;
  refreshToken?: string;
}

export function useSignIn() {
  const { client } = useNeoIdContext();
  const [status, setStatus] = useState<SignInStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [emailHint, setEmailHint] = useState<string | undefined>();
  const [loginEmail, setLoginEmail] = useState<string>("");

  const signIn = useCallback(
    async (email: string, password: string) => {
      setStatus("loading");
      setError(null);
      setLoginEmail(email);

      try {
        const res = await client.login(email, password);

        if (!res.ok || !res.data) {
          setStatus("error");
          setError(res.error?.message || "Login failed");
          return;
        }

        const data = res.data as SignInResponse;

        if (data.mfa_required) {
          setStatus("needs_mfa");
          setMfaMethods(data.mfa_methods || []);
          setPasskeyAvailable(data.passkey_available || false);
          setEmailHint(data.email_hint);
          return;
        }

        if (data.accessToken && data.refreshToken) {
          client.setTokens(data.accessToken, data.refreshToken);
          localStorage.setItem("neo_id_access_token", data.accessToken);
          localStorage.setItem("neo_id_refresh_token", data.refreshToken);
          setStatus("success");
        }
      } catch {
        setStatus("error");
        setError("Network error");
      }
    },
    [client],
  );

  const signInWithPasskey = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const startRes = await fetch(
        `${client["baseUrl"]}/api/v1/passkeys/authenticate/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "" }),
        },
      );

      if (!startRes.ok) {
        setStatus("error");
        setError("Passkey not available");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setError("Passkey authentication failed");
    }
  }, [client]);

  const verifyMfa = useCallback(
    async (method: string, code: string) => {
      setStatus("loading");
      setError(null);

      try {
        const res = await fetch(`${client["baseUrl"]}/api/v1/mfa/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, code, email: loginEmail }),
        });

        const json = await res.json();

        if (!json.ok) {
          setStatus("error");
          setError(json.error?.message || "Verification failed");
          return;
        }

        setStatus("success");
      } catch {
        setStatus("error");
        setError("Verification failed");
      }
    },
    [client, loginEmail],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setMfaMethods([]);
    setLoginEmail("");
  }, []);

  return {
    status,
    error,
    mfaMethods,
    passkeyAvailable,
    emailHint,
    signIn,
    signInWithPasskey,
    verifyMfa,
    reset,
  };
}
