"use client";

import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";

interface MfaMethodPickerProps {
  methods: string[];
  emailHint?: string;
  onSelect: (method: string) => void;
}

export function MfaMethodPicker({ methods, emailHint, onSelect }: MfaMethodPickerProps) {
  const { t } = useI18n();

  const methodInfo: Record<string, { icon: string; title: string; desc: string }> = {
    passkey: { icon: "fingerprint", title: t.auth.mfa.passkey, desc: t.auth.mfa.passkeyDesc },
    totp: { icon: "shield", title: t.auth.mfa.totp, desc: t.auth.mfa.totpDesc },
    email: { icon: "envelope", title: t.auth.mfa.emailCode, desc: `${t.auth.mfa.emailCodeDesc} ${emailHint}` },
  };

  return (
    <div className="flex flex-col gap-3">
      {methods.map((method) => {
        const info = methodInfo[method];
        if (!info) return null;
        return (
          <button
            key={method}
            type="button"
            onClick={() => onSelect(method)}
            className="flex items-center gap-3 px-5 py-4 bg-surface border border-border rounded-card hover:bg-surface-hover transition-colors text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Icon name={info.icon} size={20} className="text-accent" />
            </div>
            <div>
              <div className="text-sm font-medium text-content">{info.title}</div>
              <div className="text-xs text-muted">{info.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
