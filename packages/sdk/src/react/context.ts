"use client";

import { createContext, useContext } from "react";
import { NeoIdClient } from "../client";
import type { User } from "@neo-id/shared";

export interface NeoIdContextValue {
  client: NeoIdClient;
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
}

export const NeoIdContext = createContext<NeoIdContextValue | null>(null);

export function useNeoIdContext(): NeoIdContextValue {
  const ctx = useContext(NeoIdContext);
  if (!ctx) throw new Error("useNeoId must be used within NeoIdProvider");
  return ctx;
}
