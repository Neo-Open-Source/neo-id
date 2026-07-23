import { Suspense, type ReactNode } from "react";

export function AuthSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-svh w-screen items-center justify-center bg-surface" />}>
      {children}
    </Suspense>
  );
}
