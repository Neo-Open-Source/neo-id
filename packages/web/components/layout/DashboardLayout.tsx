"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { readCache } from "@/lib/cache";
import { logoutSession } from "@/lib/api";
import { prefetchAppBounded } from "@/lib/prefetch-app";

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
  role: string;
  ageVerified?: boolean;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { data: user, error, isLoading } = useCachedQuery<UserData>("/user/profile");

  useEffect(() => {
    if (error && !user) {
      const timer = setTimeout(() => {
        if (!readCache<UserData>("/user/profile")) {
          router.replace("/auth");
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [error, user, router]);

  useEffect(() => {
    if (user && user.ageVerified === false) {
      router.replace("/auth/age-consent");
    }
  }, [user, router]);

  const handleLogout = async () => {
    await logoutSession();
    router.replace("/auth");
  };

  const showSplash = !user && (isLoading || error === null);

  useEffect(() => {
    if (showSplash) void prefetchAppBounded();
  }, [showSplash]);

  return (
    <div className="dashboard-shell min-h-dvh bg-app flex flex-col">
      {showSplash && <SplashScreen logoSize={44} />}
      <div className="hidden md:block">
        <Header user={user ?? null} onLogout={handleLogout} />
      </div>
      <main id="main-content" className="dashboard-main flex-1 md:pt-[52px]">
        <div className="dashboard-content w-full max-w-272 mx-auto px-10 py-14 max-md:px-4 max-md:pt-6 max-md:pb-10">
          {children}
        </div>
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <BottomNav user={user ?? null} />
      <ScrollToTop />
    </div>
  );
}
