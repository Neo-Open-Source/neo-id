"use client";

import { useState } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { useI18n } from "@/lib/i18n/context";
import { usePageTitle } from "@/lib/use-page-title";

type AuthMode = "login" | "register";

interface AuthFormProps {
  initialMode?: AuthMode;
  registered?: boolean;
  initialEmail?: string;
  initialLoginStep?: "email" | "password";
}

export function AuthForm({ initialMode = "login", registered = false, initialEmail = "", initialLoginStep = "email" }: AuthFormProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [success] = useState(registered ? t.auth.register.success : "");

  const isLogin = mode === "login";
  usePageTitle(isLogin ? t.pages.authentication : t.pages.register);

  const toggleMode = () => {
    setMode(isLogin ? "register" : "login");
  };

  const subtitle = success ? t.auth.login.subtitle : (isLogin ? t.auth.login.subtitle : t.auth.register.subtitle);

  return (
    <AuthLayout title={success || (isLogin ? t.auth.login.title : t.auth.register.title)} subtitle={subtitle}>
      {isLogin ? (
        <LoginForm initialEmail={initialEmail} initialLoginStep={initialLoginStep} onToggleMode={toggleMode} />
      ) : (
        <RegisterForm initialEmail={initialEmail} onToggleMode={toggleMode} />
      )}
    </AuthLayout>
  );
}
