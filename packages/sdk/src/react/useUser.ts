"use client";

import { useNeoIdContext } from "./context";

export function useUser() {
  const { user, isLoaded, isSignedIn } = useNeoIdContext();

  return {
    isLoaded,
    isSignedIn,
    user: user
      ? {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          role: user.role,
          totpEnabled: user.totpEnabled,
          emailMfaEnabled: user.emailMfaEnabled,
        }
      : null,
  };
}
