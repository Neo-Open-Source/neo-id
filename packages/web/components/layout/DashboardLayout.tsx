"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { logoutSession, api } from "@/lib/api";

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

  const { data: user, error } = useCachedQuery<UserData>("/user/profile", {
    enabled: !isSupportPage,
  });

  useEffect(() => {
    if (error && !user) {
      router.replace("/auth");
    }
  }, [error, user, router]);

  const fetchOpenTickets = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    try {
      const tickets = await api<Ticket[]>("/admin/support/tickets");
      const openCount = tickets.filter((t) => t.status === "open").length;
      setOpenTicketCount(openCount);
    } catch {
      // silently fail - badge is non-critical
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

  // Support page works for everyone — no auth required
  if (isSupportPage) {
    return <>{children}</>;
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
    <div className="min-h-screen bg-app">
      <Sidebar user={user} onLogout={handleLogout} openTicketCount={openTicketCount} />
      <main className="dashboard-main ml-20 min-h-svh max-md:ml-0">
        <div className="dashboard-content w-full max-w-272 mx-auto px-10 py-14 max-md:px-4 max-md:py-6">{children}</div>
      </main>
      <BottomNav user={user} onLogout={handleLogout} openTicketCount={openTicketCount} />
      <ScrollToTop />
    </div>
  );
}
