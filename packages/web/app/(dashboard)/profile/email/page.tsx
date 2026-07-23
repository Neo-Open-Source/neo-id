"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { api, ApiError } from "@/lib/api";
import { usePageTitle } from "@/lib/use-page-title";

export default function EmailPage() {
  const { t } = useI18n();
  usePageTitle(t.pages.changeEmail);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { api<{ email: string }>("/user/profile").then((data) => setEmail(data.email)).catch(() => setMessage(t.common.error)); }, [t.common.error]);

  const requestCode = async () => {
    if (!newEmail || loading) return;
    setLoading(true); setMessage(null);
    try { await api("/user/email/change/request", { method: "POST", body: { newEmail } }); setSent(true); }
    catch (error) { setMessage(error instanceof ApiError ? error.message : t.common.error); }
    finally { setLoading(false); }
  };

  const confirm = async () => {
    if (!code || loading) return;
    setLoading(true); setMessage(null);
    try { await api("/user/email/change/confirm", { method: "POST", body: { newEmail, code } }); window.location.href = "/profile"; }
    catch (error) { setMessage(error instanceof ApiError ? error.message : t.common.error); }
    finally { setLoading(false); }
  };

  return (
    <div className="email-change-page">
      <BackButton href="/profile" label={t.profile.backToProfile} />
      <section className="email-change-card">
        <div className="email-change-icon"><Icon name="envelope" size={22} /></div>
        <h1>{t.profile.changeEmail}</h1>
        <p>{t.profile.emailChangeIntro}</p>
        <div className="email-change-current"><span>{t.profile.currentEmail}</span><strong>{email}</strong></div>
        <Input label={t.profile.newEmail} type="email" value={newEmail} disabled={sent} onChange={(event) => setNewEmail(event.target.value)} placeholder={t.auth.emailPlaceholder} required />
        {sent && <><p className="email-change-hint">{t.profile.emailChangeCodeHint}</p><Input label={t.profile.emailChangeCode} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={t.auth.mfa.codePlaceholder} required /></>}
        {message && <div className="alert alert--error">{message}</div>}
        <Button className="w-full" loading={loading} disabled={sent ? code.length !== 6 : !newEmail} onClick={sent ? confirm : requestCode}>{sent ? t.profile.confirmEmailChange : t.profile.verifyCurrentEmail}</Button>
      </section>
    </div>
  );
}
