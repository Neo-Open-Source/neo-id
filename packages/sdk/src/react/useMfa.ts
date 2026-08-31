"use client";

import { useState, useEffect, useCallback } from "react";
import { useNeoIdContext } from "./context";
import type { User, Passkey, ApiResponse } from "@neo-id/shared";

export function useMfa() {
  const { client } = useNeoIdContext();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [emailMfaEnabled, setEmailMfaEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);

  useEffect(() => {
    client.getProfile().then((res: ApiResponse<User>) => {
      if (res.ok && res.data) {
        setTotpEnabled(res.data.totpEnabled);
        setEmailMfaEnabled(res.data.emailMfaEnabled);
      }
    });
    client.getPasskeys().then((res: ApiResponse<Passkey[]>) => {
      if (res.ok && res.data) {
        setPasskeys(res.data);
      }
    });
  }, [client]);

  const setupTotp = useCallback(async () => {
    const res = await client.setupTotp();
    return res.ok ? res.data : null;
  }, [client]);

  const enableTotp = useCallback(
    async (code: string) => {
      const res = await client.enableTotp(code);
      if (res.ok) setTotpEnabled(true);
      return res.ok;
    },
    [client],
  );

  const disableTotp = useCallback(async () => {
    const res = await client.disableTotp();
    if (res.ok) setTotpEnabled(false);
    return res.ok;
  }, [client]);

  const setupEmailMfa = useCallback(async () => {
    const res = await client.setupEmailMfa();
    return res.ok ? res.data : null;
  }, [client]);

  const enableEmailMfa = useCallback(
    async (code: string) => {
      const res = await client.enableEmailMfa(code);
      if (res.ok) setEmailMfaEnabled(true);
      return res.ok;
    },
    [client],
  );

  const disableEmailMfa = useCallback(async () => {
    const res = await client.disableEmailMfa();
    if (res.ok) setEmailMfaEnabled(false);
    return res.ok;
  }, [client]);

  const deletePasskey = useCallback(
    async (id: string) => {
      const res = await client.deletePasskey(id);
      if (res.ok) setPasskeys((prev) => prev.filter((p) => p.id !== id));
      return res.ok;
    },
    [client],
  );

  return {
    totpEnabled,
    emailMfaEnabled,
    passkeys,
    setupTotp,
    enableTotp,
    disableTotp,
    setupEmailMfa,
    enableEmailMfa,
    disableEmailMfa,
    deletePasskey,
  };
}
