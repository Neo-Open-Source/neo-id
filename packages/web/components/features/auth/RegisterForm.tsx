"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoogleIcon, GithubIcon } from "@/components/ui/ProviderIcons";
import { Turnstile } from "@/components/ui/Turnstile";
import { setSessionTokens } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

interface RegisterFormProps {
  initialEmail?: string;
  onToggleMode: () => void;
}

export function RegisterForm({ initialEmail = "", onToggleMode }: RegisterFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const canSubmit = email.length > 0 && username.length > 0 && password.length > 0 && ageConfirmed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, username, password, ageConfirmed, cfTurnstileToken: turnstileToken }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || t.auth.errors.registerFailed);
        setLoading(false);
        return;
      }

      if (json.data?.accessToken || json.data?.refreshToken) {
        setSessionTokens({
          accessToken: json.data.accessToken,
          refreshToken: json.data.refreshToken,
        });
      }

      if (json.data?.emailVerified === false) {
        router.push(`/auth/2fa/mfa?email=${encodeURIComponent(email)}&purpose=verify_email`);
      } else {
        router.push("/profile");
      }
    } catch {
      toast.error(t.auth.errors.network);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div key="register" className="flex flex-col gap-5 animate-authSlideIn">
        <Input
          label={t.auth.email}
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t.auth.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="animate-fadeIn">
          <Input
            label={t.auth.username}
            type="text"
            name="username"
            autoComplete="username"
            placeholder={t.auth.usernamePlaceholder}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <Input
          label={t.auth.password}
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder={t.auth.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={ageConfirmed}
          onChange={(e) => setAgeConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-border text-accent accent-accent cursor-pointer"
        />
        <span className="text-sm text-muted leading-snug">{t.auth.register.ageConfirm}</span>
      </label>

      {turnstileSiteKey && (
        <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      )}

      <Button type="submit" loading={loading} disabled={!canSubmit || (!!turnstileSiteKey && !turnstileToken)} className="w-full">
        {t.auth.register.button}
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-dim">{t.auth.or}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => window.location.href = "/api/v1/auth/oauth/google"} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-surface-hover hover:border-border-hover transition-all">
          <GoogleIcon size={18} />
        </button>
        <button type="button" onClick={() => window.location.href = "/api/v1/auth/oauth/github"} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-surface-hover hover:border-border-hover transition-all">
          <GithubIcon size={18} />
        </button>
      </div>

      <p className="text-sm text-muted text-center mt-2">
        {t.auth.register.hasAccount}{" "}
        <button type="button" onClick={onToggleMode} className="text-accent hover:text-accent-hover font-medium transition-colors">
          {t.auth.register.signIn}
        </button>
      </p>
    </form>
  );
}
