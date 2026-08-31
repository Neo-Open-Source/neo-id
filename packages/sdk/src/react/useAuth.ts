"use client";

import { useCallback } from "react";
import { useNeoIdContext } from "./context";

export function useAuth() {
  const { client, user, isLoaded, isSignedIn } = useNeoIdContext();

  const signOut = useCallback(async () => {
    await client.logout();
    localStorage.removeItem("neo_id_access_token");
    localStorage.removeItem("neo_id_refresh_token");
    window.location.href = "/auth/login";
  }, [client]);

  const getToken = useCallback(async () => {
    return client.getAccessToken();
  }, [client]);

  return {
    isLoaded,
    isSignedIn,
    userId: user?.id || null,
    sessionId: null,
    role: user?.role || null,
    getToken,
    signOut,
  };
}
