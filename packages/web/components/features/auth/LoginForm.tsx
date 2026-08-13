"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoogleIcon, GithubIcon } from "@/components/ui/ProviderIcons";
import { Icon } from "@/components/ui/Icon";
import { Turnstile } from "@/components/ui/Turnstile";
import { setSessionTokens } from "@/lib/api";
import { resolveAuthRedirect } from "@/lib/auth-redirect";
import { useI18n } from "@/lib/i18n/context";

interface LoginFormProps {
  initialEmail?: string;
  initialLoginStep?: "email" | "password";
  onToggleMode: () => void;
}

export function LoginForm({ initialEmail = "", initialLoginStep = "email", onToggleMode }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">(initialLoginStep);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const afterLogin = resolveAuthRedirect(searchParams.get("redirect"));

  const afterLoginParam =
    afterLogin && afterLogin !== "/profile" ? `&redirect=${encodeURIComponent(afterLogin)}` : "";

  /** Social login must keep the OAuth authorize path so consent shows after sign-in. */
  const startSocial = (provider: "google" | "github") => {
    const url = new URL(`/api/v1/auth/oauth/${provider}`, window.location.origin);
    if (afterLogin && afterLogin !== "/profile") {
      url.searchParams.set("return_to", afterLogin);
    }
    window.location.href = url.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (step === "email") {
      setStep("password");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, cfTurnstileToken: turnstileToken }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || t.auth.errors.loginFailed);
        setLoading(false);
        return;
      }

      if (json.data?.mfaRequired) {
        const methods = json.data.mfaMethods?.join(",") || "";
        const emailHint = json.data.emailHint || "";
        const mfaUrl = new URL("/auth/2fa", window.location.origin);
        mfaUrl.searchParams.set("email", email);
        mfaUrl.searchParams.set("methods", methods);
        mfaUrl.searchParams.set("emailHint", emailHint);
        mfaUrl.searchParams.set("redirect", afterLogin);
        router.push(`${mfaUrl.pathname}${mfaUrl.search}`);
        return;
      }

      if (json.data?.accessToken || json.data?.refreshToken) {
        setSessionTokens({
          accessToken: json.data.accessToken,
          refreshToken: json.data.refreshToken,
        });
      }

      // OAuth authorize must be a full document navigation so 302 → consent works
      if (afterLogin.startsWith("/api/")) {
        window.location.assign(afterLogin);
        return;
      }
      router.push(afterLogin);
    } catch {
      toast.error(t.auth.errors.network);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div key={step} className="flex flex-col gap-5 animate-authSlideIn">
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

        {step === "password" && (
          <div className="animate-fadeIn">
            <Input
              label={t.auth.password}
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={t.auth.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      {step === "password" && turnstileSiteKey && (
        <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      )}

      <Button
        type="submit"
        loading={loading}
        disabled={!email || (step === "password" && (!password || (!!turnstileSiteKey && !turnstileToken)))}
        className="w-full"
      >
        {step === "email" ? t.auth.login.continue : t.auth.login.button}
      </Button>

      {step === "password" && (
        <>
          <button type="button" onClick={() => router.push(`/auth/2fa/passkey?email=${encodeURIComponent(email)}&fallback=password${afterLoginParam}`)} className="inline-flex items-center justify-center gap-2 text-muted text-sm cursor-pointer hover:text-content">
            <Icon name="key" size={15} />
            {t.auth.login.usePasskey}
          </button>
          <button type="button" onClick={() => router.push(`/auth/forgot-password?email=${encodeURIComponent(email)}${afterLoginParam}`)} className="text-sm text-accent hover:text-accent-hover cursor-pointer transition-colors">
            {t.auth.login.forgotPassword}
          </button>
        </>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-dim">{t.auth.or}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => startSocial("google")} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-surface-hover hover:border-border-hover transition-all">
          <GoogleIcon size={18} />
        </button>
        <button type="button" onClick={() => startSocial("github")} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-surface-hover hover:border-border-hover transition-all">
          <GithubIcon size={18} />
        </button>
      </div>

      <p className="text-sm text-muted text-center mt-2">
        {t.auth.login.noAccount}{" "}
        <button type="button" onClick={onToggleMode} className="text-accent hover:text-accent-hover font-medium transition-colors">
          {t.auth.login.createOne}
        </button>
      </p>
    </form>
  );
}
