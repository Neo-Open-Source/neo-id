"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function DeviceContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [userCode, setUserCode] = useState(initialCode);
  const [deviceInfo, setDeviceInfo] = useState<{
    location?: string;
    expires_at?: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const checkDeviceCode = useCallback(async (code: string) => {
    if (!code || code.length < 7) return;

    try {
      const res = await fetch(`/api/v1/device/verify?code=${code}`);
      const json = await res.json();

      if (json.ok && json.data) {
        setDeviceInfo(json.data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      checkDeviceCode(initialCode);
    }
  }, [initialCode, checkDeviceCode]);

  const handleApprove = async () => {
    if (!userCode) return;

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/v1/device/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("neo_id_access_token")}`,
        },
        body: JSON.stringify({ user_code: userCode }),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.error?.message || "Failed to approve");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setError("Network error");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <AuthLayout title="Device connected" subtitle="You can close this page">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <p className="text-sm text-muted">Your device has been authorized successfully.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Connect your device" subtitle="Enter the code displayed on your device">
      <div className="flex flex-col gap-5">
        {error && (
          <div className="px-4 py-3 text-sm text-danger bg-danger/10 rounded-badge">
            {error}
          </div>
        )}

        <Input
          label="Device code"
          type="text"
          name="code"
          placeholder="ABC-1234"
          value={userCode}
          onChange={(e) => setUserCode(e.target.value.toUpperCase())}
          autoFocus
          required
        />

        {deviceInfo && (
          <div className="px-4 py-3 bg-surface-hover rounded-card">
            <p className="text-sm text-content font-medium">
              {deviceInfo.location || "Unknown device"}
            </p>
            {deviceInfo.expires_at && (
              <p className="text-xs text-muted mt-1">
                Code expires {new Date(deviceInfo.expires_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        <Button onClick={handleApprove} loading={status === "loading"} className="w-full">
          Approve
        </Button>

        <Button variant="ghost" className="w-full" onClick={() => window.history.back()}>
          Cancel
        </Button>
      </div>
    </AuthLayout>
  );
}

export default function DeviceVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DeviceContent />
    </Suspense>
  );
}
