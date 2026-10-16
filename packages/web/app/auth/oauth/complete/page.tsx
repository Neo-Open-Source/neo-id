"use client";

import { Suspense } from "react";
import { SplashScreen } from "@/components/ui/SplashScreen";
import OAuthCompletePage from "./OAuthCompleteClient";

export default function Page() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <OAuthCompletePage />
    </Suspense>
  );
}
