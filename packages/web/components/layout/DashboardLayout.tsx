"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { readCache } from "@/lib/cache";
import { logoutSession, api, hasSession } from "@/lib/api";

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
  role: string;
}

interface Ticket {
  id: string;
  status: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [openTicketCount, setOpenTicketCount] = useState(0);

  const isSupportPage = pathname.startsWith("/support");
  const isSupportChat = /^\/support\/[^/]+$/.test(pathname);

  // Initialize from cache so support page doesn't flash a spinner
  const [supportMode, setSupportMode] = useState<"pending" | "anon" | "authed">(() => {
    if (isSupportPage && readCache<UserData>("/user/profile")) return "authed";
    return "pending";
  });

  useEffect(() => {
    if (!isSupportPage) {
      setSupportMode("pending");
      return;
    }

    if (readCache<UserData>("/user/profile")) {
      setSupportMode("authed");
      return;
    }

    let cancelled = false;
    setSupportMode("pending");
    hasSession().then((authed) => {
      if (!cancelled) setSupportMode(authed ? "authed" : "anon");
    });
    return () => {
      cancelled = true;
    };
  }, [isSupportPage, pathname]);

  const loadProfile = !isSupportPage || supportMode === "authed";

  const { data: user, error } = useCachedQuery<UserData>("/user/profile", {
    enabled: loadProfile,
  });

  // Redirect to auth on error, but only after a short delay to avoid
  // flashing on transient network failures
  useEffect(() => {
    if (isSupportPage) return;
    if (error && !user) {
      const timer = setTimeout(() => {
        // Re-check — cached data may have arrived by now
        if (!readCache<UserData>("/user/profile")) {
          router.replace("/auth");
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [error, user, router, isSupportPage]);

  const fetchOpenTickets = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    try {
      const tickets = await api<Ticket[]>("/admin/support/tickets");
      const openCount = tickets.filter((t) => t.status === "open").length;
      setOpenTicketCount(openCount);
    } catch {
      // silently fail — badge is non-critical
    }
  }, [user]);

  useEffect(() => {
    void fetchOpenTickets();
    const interval = setInterval(fetchOpenTickets, 60000);
    return () => clearInterval(interval);
  }, [fetchOpenTickets]);

  const handleLogout = async () => {
    await logoutSession();
    router.replace("/auth");
  };

  // Anonymous support — no profile fetch, no redirect to auth
  if (isSupportPage && supportMode === "anon") {
    return <>{children}</>;
  }

  if (isSupportPage && supportMode === "pending") {
    return (
      <div className="min-h-screen bg-app">
        <div className="loading">
          <div className="loading__spinner" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-app">
        <div className="loading">
          <div className="loading__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app flex flex-col">
      <Header user={user} openTicketCount={openTicketCount} />
      <main className={`dashboard-main${isSupportChat ? " dashboard-main--chat" : " flex-1"}`}>
        <div className="dashboard-content w-full max-w-272 mx-auto px-10 py-14 max-md:px-4 max-md:pt-6 max-md:pb-24">{children}</div>
      </main>
      {!isSupportChat && (
        <>
          <BottomNav user={user} onLogout={handleLogout} openTicketCount={openTicketCount} />
          <Footer />
        </>
      )}
      <ScrollToTop />
    </div>
  );
}
