"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message || "Login failed");
        setLoading(false);
        return;
      }

      if (json.data?.mfa_required) {
        // Redirect to MFA page with methods info
        const params = new URLSearchParams({
          methods: json.data.mfa_methods?.join(",") || "",
          email: email,
        });
        router.push(`/auth/mfa?${params.toString()}`);
      } else {
        // Store tokens and redirect
        localStorage.setItem("access_token", json.data.accessToken);
        localStorage.setItem("refresh_token", json.data.refreshToken);
        router.push("/profile");
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Enter your credentials to continue"
      footer={{
        text: "Don't have an account?",
        link: "/auth/register",
        label: "Create one",
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="px-4 py-3 text-sm text-danger bg-danger/10 rounded-badge">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-dim">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex items-center justify-center gap-3">
        <a
          href="/api/auth/oauth/google"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-surface-hover hover:border-border-hover transition-all"
        >
          <span className="text-sm font-medium text-muted">G</span>
        </a>
        <a
          href="/api/auth/oauth/github"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-surface-hover hover:border-border-hover transition-all"
        >
          <span className="text-sm font-medium text-muted">GH</span>
        </a>
      </div>
    </AuthLayout>
  );
}
