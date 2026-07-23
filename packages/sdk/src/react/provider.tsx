"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { NeoIdClient } from "../client";
import { NeoIdContext, type NeoIdContextValue } from "./context";
import type { User, ApiResponse } from "@neo-id/shared";

interface NeoIdProviderProps {
  baseUrl: string;
  children: ReactNode;
}

export function NeoIdProvider({ baseUrl, children }: NeoIdProviderProps) {
  const [client] = useState(() => new NeoIdClient({ baseUrl }));
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const accessToken = localStorage.getItem("neo_id_access_token");
    const refreshToken = localStorage.getItem("neo_id_refresh_token");

    if (accessToken && refreshToken) {
      client.setTokens(accessToken, refreshToken);
      client
        .getProfile()
        .then((res: ApiResponse<User>) => {
          if (res.ok && res.data) {
            setUser(res.data);
          } else {
            return client.refresh();
          }
        })
        .then((res: ApiResponse<{ accessToken: string; refreshToken: string }> | undefined) => {
          if (res && res.ok && res.data) {
            client.setTokens(res.data.accessToken, res.data.refreshToken);
            localStorage.setItem("neo_id_access_token", res.data.accessToken);
            localStorage.setItem("neo_id_refresh_token", res.data.refreshToken);
            return client.getProfile();
          }
          return undefined;
        })
        .then((res: ApiResponse<User> | undefined) => {
          if (res && res.ok && res.data) {
            setUser(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoaded(true));
    } else {
      setIsLoaded(true);
    }
  }, [client]);

  const value: NeoIdContextValue = {
    client,
    user,
    isLoaded,
    isSignedIn: !!user,
  };

  return (
    <NeoIdContext.Provider value={value}>{children}</NeoIdContext.Provider>
  );
}
