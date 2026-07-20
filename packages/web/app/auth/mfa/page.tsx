"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function MfaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const methods = searchParams.get("methods")?.split(",") || [];
  const emailHint = searchParams.get("email_hint") || "";
  const [selectedMethod, setSelectedMethod] = useState<string | null>(
    methods.length === 1 ? methods[0] : null,
  );
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod || !code) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: selectedMethod,
          code,
          email: searchParams.get("email") || "",
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.error?.message || "Verification failed");
        setLoading(false);
        return;
      }

      router.push("/profile");
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  // Method picker
  if (!selectedMethod) {
    return (
      <AuthLayout title="Verify your identity" subtitle="Choose a verification method">
        <div className="flex flex-col gap-3">
          {methods.includes("passkey") && (
            <button
              type="button"
              onClick={() => {
                window.navigator.credentials.get({
                  publicKey: {
                    challenge: new Uint8Array(32),
                    timeout: 60000,
                    rpId: window.location.hostname,
                    userVerification: "preferred",
                  },
                });
              }}
              className="flex items-center gap-3 px-5 py-4 bg-surface border border-border rounded-card hover:bg-surface-hover transition-colors text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-lg">🔑</span>
              </div>
              <div>
                <div className="text-sm font-medium text-content">Passkey</div>
                <div className="text-xs text-muted">Use your device biometrics</div>
              </div>
            </button>
          )}

          {methods.includes("totp") && (
            <button
              type="button"
              onClick={() => setSelectedMethod("totp")}
              className="flex items-center gap-3 px-5 py-4 bg-surface border border-border rounded-card hover:bg-surface-hover transition-colors text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-lg">📱</span>
              </div>
              <div>
                <div className="text-sm font-medium text-content">Authenticator app</div>
                <div className="text-xs text-muted">Google Authenticator, Authy</div>
              </div>
            </button>
          )}

          {methods.includes("email") && (
            <button
              type="button"
              onClick={() => setSelectedMethod("email")}
              className="flex items-center gap-3 px-5 py-4 bg-surface border border-border rounded-card hover:bg-surface-hover transition-colors text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-lg">📧</span>
              </div>
              <div>
                <div className="text-sm font-medium text-content">Email code</div>
                <div className="text-xs text-muted">Send to {emailHint}</div>
              </div>
            </button>
          )}
        </div>
      </AuthLayout>
    );
  }

  // Code input
  return (
    <AuthLayout
      title={
        selectedMethod === "totp"
          ? "Enter authenticator code"
          : "Enter verification code"
      }
      subtitle={
        selectedMethod === "totp"
          ? "Open your authenticator app and enter the 6-digit code"
          : `We sent a code to ${emailHint}`
      }
    >
      <form onSubmit={handleVerify} className="flex flex-col gap-5">
        {error && (
          <div className="px-4 py-3 text-sm text-danger bg-danger/10 rounded-badge">
            {error}
          </div>
        )}

        <Input
          label="Verification code"
          type="text"
          name="code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
        />

        <Button type="submit" loading={loading} className="w-full">
          Verify
        </Button>

        {selectedMethod === "email" && (
          <p className="text-sm text-muted text-center">
            <button
              type="button"
              className="text-accent hover:text-accent-hover cursor-pointer"
              onClick={() => {
                fetch("/api/v1/mfa/email/setup", { method: "POST" });
              }}
            >
              Resend code
            </button>
          </p>
        )}

        {methods.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setSelectedMethod(null);
              setCode("");
              setError("");
            }}
            className="text-sm text-muted text-center hover:text-content cursor-pointer"
          >
            Use a different method
          </button>
        )}
      </form>
    </AuthLayout>
  );
}

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MfaContent />
    </Suspense>
  );
}
