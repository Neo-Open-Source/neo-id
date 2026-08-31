"use client";

import { Suspense } from "react";
import OAuthCompletePage from "./OAuthCompleteClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="loading">
          <div className="loading__spinner" />
        </div>
      }
    >
      <OAuthCompletePage />
    </Suspense>
  );
}
