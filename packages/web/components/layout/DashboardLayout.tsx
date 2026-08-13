"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { readCache } from "@/lib/cache";
import { logoutSession } from "@/lib/api";

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
  role: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { data: user, error } = useCachedQuery<UserData>("/user/profile", {
    enabled: true,
  });

  // Redirect to auth on error, but only after a short delay to avoid
  // flashing on transient network failures
  useEffect(() => {
    if (error && !user) {
      const timer = setTimeout(() => {
        // Re-check — cached data may have arrived by now
        if (!readCache<UserData>("/user/profile")) {
          router.replace("/auth");
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [error, user, router]);

  const handleLogout = async () => {
    await logoutSession();
    router.replace("/auth");
  };

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
    <div className="dashboard-shell min-h-dvh bg-app flex flex-col">
      <div className="hidden md:block">
        <Header user={user} />
      </div>
      <main className="dashboard-main flex-1 md:pt-[52px]">
        <div className="dashboard-content w-full max-w-272 mx-auto px-10 py-14 max-md:px-4 max-md:pt-6 max-md:pb-10">{children}</div>
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <BottomNav user={user} onLogout={handleLogout} />
      <ScrollToTop />
    </div>
  );
}
