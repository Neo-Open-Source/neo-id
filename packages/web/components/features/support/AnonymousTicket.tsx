"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/context";
import { api } from "@/lib/api";

interface Message {
  id: string;
  authorRole: "user" | "admin" | "system";
  body: string;
  createdAt: string;
}

interface AnonymousTicketData {
  id: string;
  name: string;
  email: string;
  subject: string;
  messages: Message[];
  createdAt: string;
  isLocal: boolean;
}

const STORAGE_KEY = "neo_anon_ticket";

// ─── Knowledge Base ──────────────────────────────────────────────────────────

interface KBArticle {
  keywords: string[];
  answer: string;
}

const KB_ARTICLES: KBArticle[] = [
  {
    keywords: ["register", "registration", "sign up", "create account", "create", "signup",
      "регистр", "зарег", "создать аккаунт", "створити акаунт", "новий акаунт", "реєстрац"],
    answer: "How to create an account:\n\n1. Go to the login page and click 'Create one'\n2. Enter your email address\n3. Choose a username (3-20 characters, letters, numbers, underscores)\n4. Create a strong password (at least 8 characters)\n5. Confirm you're at least 16 years old\n6. Click 'Create account'\n7. Check your email for a verification code\n8. Enter the code to verify your email\n\nCommon issues:\n• Username must be unique — if taken, try another\n• Password must be at least 8 characters\n• Check your spam folder if you don't see the verification email\n• Make sure your email address is correct",
  },
  {
    keywords: ["password", "reset", "forgot", "пароль", "забыл", "забутий", "змінити пароль"],
    answer: "To reset your password:\n\n1. Go to the login page\n2. Click 'Forgot password?'\n3. Enter your email\n4. Check your inbox for the reset link\n5. Click the link and create a new password\n\nIf you don't receive the email:\n• Check your spam/junk folder\n• Make sure you entered the correct email\n• Wait up to 5 minutes\n• Try again or contact support",
  },
  {
    keywords: ["2fa", "mfa", "two-factor", "authenticator", "code", "двухфакторн", "двофакторн", "аутентифікатор"],
    answer: "Two-factor authentication (2FA) adds extra security.\n\nTo enable:\n1. Go to Profile → Two-factor authentication\n2. Choose a method:\n   • Authenticator app (Google Authenticator, Authy)\n   • Email codes\n   • Passkeys\n3. Follow the setup instructions\n\nIf you lost access to your 2FA device, contact support with your account email.",
  },
  {
    keywords: ["passkey", "biometric", "fingerprint", "face", "face id", "ключ", "біометр", "biometrics"],
    answer: "Passkeys let you sign in with biometrics (fingerprint, Face ID).\n\nTo set up:\n1. Go to Profile → Passkeys\n2. Click 'Add passkey'\n3. Follow your device's prompt\n\nPasskeys work on Chrome, Safari, and Edge.",
  },
  {
    keywords: ["delete", "account", "remove", "видалити", "аккаунт", "акаунт", "видалити акаунт"],
    answer: "To delete your account:\n1. Go to Profile\n2. Scroll to the bottom\n3. Click 'Delete account'\n4. Confirm with your password\n\nWarning: This is irreversible. All your data will be permanently deleted.",
  },
  {
    keywords: ["oauth", "google", "github", "social", "login", "увійти", "увійти через", "sign in with"],
    answer: "Sign in with Google or GitHub:\n1. Click the Google/GitHub button on the login page\n2. Authorize Neo ID in the popup\n3. You'll be signed in automatically\n\nIf you have an account with the same email, it will be linked automatically.",
  },
  {
    keywords: ["session", "device", "sign out", "logout", "сесія", "пристрій", "вийти", "вихід"],
    answer: "To manage sessions:\n1. Go to Sessions in the sidebar\n2. See all devices where you're signed in\n3. Click 'Sign out' on any device\n\nSign out from devices you don't recognize.",
  },
  {
    keywords: ["language", "українська", "руська", "english", "мова", "змінити мову", "language"],
    answer: "To change language:\n1. Go to Profile → Language\n2. Select your preferred language\n\nSupported: English, Ukrainian, Russian, Romanian.",
  },
  {
    keywords: ["email", "change", "verify", "підтвердити", "змінити email", "пошта", "verification"],
    answer: "To change or verify your email:\n\nTo verify:\n1. Check your inbox for the verification code\n2. Enter the code on the verification page\n\nTo change email:\n1. Go to Profile → Email\n2. Enter your new email\n3. Check your new email for a verification code\n4. Enter the code to confirm",
  },
];

function findKBMatch(query: string): string | null {
  const lower = query.toLowerCase();
  for (const article of KB_ARTICLES) {
    if (article.keywords.some((kw) => lower.includes(kw))) {
      return article.answer;
    }
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

function loadTicket(): AnonymousTicketData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveTicket(ticket: AnonymousTicketData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ticket));
}

function clearTicket() {
  localStorage.removeItem(STORAGE_KEY);
}

export function AnonymousTicket() {
  const { t } = useI18n();
  const [ticket, setTicket] = useState<AnonymousTicketData | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => {
    setTicket(loadTicket());
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages.length]);

  // Poll for admin replies every 10 seconds
  useEffect(() => {
    if (!ticket || ticket.isLocal) return;

    const poll = async () => {
      try {
        const data = await api<AnonymousTicketData>(`/support/anonymous/${ticket.id}?email=${encodeURIComponent(ticket.email)}`);
        if (data.messages.length > ticket.messages.length) {
          const updated = { ...ticket, messages: data.messages };
          saveTicket(updated);
          setTicket(updated);
        }
      } catch {
        // silent
      }
    };

    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [ticket]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      authorRole: "user",
      body: message.trim(),
      createdAt: new Date().toISOString(),
    };

    // Check knowledge base first
    const kbAnswer = findKBMatch(message);

    if (kbAnswer) {
      const systemMsg: Message = {
        id: crypto.randomUUID(),
        authorRole: "system",
        body: kbAnswer,
        createdAt: new Date().toISOString(),
      };

      const localTicket: AnonymousTicketData = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        messages: [userMsg, systemMsg],
        createdAt: new Date().toISOString(),
        isLocal: true,
      };

      saveTicket(localTicket);
      setTicket(localTicket);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      return;
    }

    // No KB match — create real ticket via API
    setSending(true);
    try {
      const result = await api<{ id: string }>("/support/anonymous", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() },
      });

      const systemMsg: Message = {
        id: crypto.randomUUID(),
        authorRole: "system",
        body: "Your ticket has been created. Our support team will review it and respond to your email. You can also check back here for updates.",
        createdAt: new Date().toISOString(),
      };

      const newTicket: AnonymousTicketData = {
        id: result.id,
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        messages: [userMsg, systemMsg],
        createdAt: new Date().toISOString(),
        isLocal: false,
      };

      saveTicket(newTicket);
      setTicket(newTicket);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      // Fallback to local
      const localTicket: AnonymousTicketData = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        messages: [
          userMsg,
          {
            id: crypto.randomUUID(),
            authorRole: "system",
            body: "We've received your message. Our team will get back to you at " + email.trim(),
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        isLocal: true,
      };
      saveTicket(localTicket);
      setTicket(localTicket);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending || !ticket) return;
    setSending(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      authorRole: "user",
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };

    // Check knowledge base
    const kbAnswer = findKBMatch(text);

    if (kbAnswer) {
      const systemMsg: Message = {
        id: crypto.randomUUID(),
        authorRole: "system",
        body: kbAnswer,
        createdAt: new Date().toISOString(),
      };

      const updated = {
        ...ticket,
        messages: [...ticket.messages, userMsg, systemMsg],
      };
      saveTicket(updated);
      setTicket(updated);
      setText("");
      setSending(false);
      scrollToBottom();
      return;
    }

    // Add user message locally
    const updated = {
      ...ticket,
      messages: [...ticket.messages, userMsg],
    };
    saveTicket(updated);
    setTicket(updated);
    setText("");
    scrollToBottom();

    // Send to API if not local
    if (!ticket.isLocal) {
      try {
        await api(`/support/anonymous/${ticket.id}/messages`, {
          method: "POST",
          body: { message: text.trim(), email: ticket.email },
        });
      } catch {
        // saved locally
      }
    } else {
      // Auto-reply for local tickets
      setTimeout(() => {
        const autoReply: Message = {
          id: crypto.randomUUID(),
          authorRole: "system",
          body: "We've received your message. Our team will get back to you as soon as possible.",
          createdAt: new Date().toISOString(),
        };
        const withReply = {
          ...updated,
          messages: [...updated.messages, userMsg, autoReply],
        };
        saveTicket(withReply);
        setTicket(withReply);
        scrollToBottom();
      }, 1500);
    }

    setSending(false);
  };

  const handleClear = () => {
    clearTicket();
    setTicket(null);
  };

  if (ticket) {
    return (
      <div className="flex flex-col h-screen bg-app">
        <div className="flex-none px-4 py-3 bg-surface border-b border-border">
          <BackButton onClick={handleClear} label={t.support.title} className="mb-0" />
          <h1 className="text-lg font-bold text-content mt-1">{ticket.subject}</h1>
          <span className="text-xs text-dim">{ticket.email}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            {ticket.messages.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="spinner" />
              </div>
            ) : (
              ticket.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.authorRole === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.authorRole === "user"
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-surface-row text-content rounded-bl-md border border-border"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    <span className={`text-[10px] mt-1 block ${msg.authorRole === "user" ? "text-white/60" : "text-dim"}`}>
                      {msg.authorRole === "admin" ? "Support" : msg.authorRole === "system" ? "Auto-reply" : ticket.name} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="flex-none px-4 py-3 bg-surface border-t border-border">
          <div className="max-w-2xl mx-auto flex items-end gap-2">
            <textarea
              className="flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-content placeholder:text-dim outline-none focus:border-accent transition-colors"
              placeholder={t.support.messagePlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="button"
              disabled={!text.trim() || sending}
              onClick={handleSend}
              className="flex-none w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
            >
              {sending ? <div className="spinner" /> : <Icon name="arrow-up" size={18} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-card border border-border shadow-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <Image src="/splash-icon.png" alt="Neo ID" width={32} height={32} className="w-8 h-8" />
            <span className="text-lg font-bold text-content">Neo ID</span>
          </div>
          <h1 className="text-xl font-bold text-content mb-1">{t.support.title}</h1>
          <p className="text-sm text-muted mb-6">{t.support.subtitle}</p>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
            <Input
              label={t.support.subject}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t.support.subjectPlaceholder}
              required
            />
            <div className="input-wrapper">
              <label className="input-label">{t.support.message}</label>
              <textarea
                className="input input--textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.support.messagePlaceholder}
                rows={4}
                required
              />
            </div>
            <Button type="submit" className="w-full" loading={sending} disabled={!name.trim() || !email.trim() || !subject.trim() || !message.trim()}>
              {t.support.send}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-dim mt-4">
          <button onClick={() => window.history.back()} className="hover:text-muted transition-colors">
            {t.auth.forgotPassword.backToLogin}
          </button>
        </p>
      </div>
    </div>
  );
}
