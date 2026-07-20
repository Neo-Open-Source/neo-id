"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          password,
          ageConfirmed: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message || "Registration failed");
        setLoading(false);
        return;
      }

      // Redirect to login after successful registration
      router.push("/auth/login?registered=true");
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Fill in the details below"
      footer={{
        text: "Already have an account?",
        link: "/auth/login",
        label: "Sign in",
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
          label="Username"
          type="text"
          name="username"
          autoComplete="username"
          placeholder="yourname"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" loading={loading} className="w-full">
          Create account
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
