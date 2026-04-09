"use client";
import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { usePresence } from "@/lib/hooks/usePresence";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

function NotificationBanner() {
  const { permission, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true); // start hidden, check after mount

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDismissed = localStorage.getItem("notif-banner-dismissed");
    if (!isDismissed && "Notification" in window && Notification.permission === "default") {
      setDismissed(false);
    }
  }, []);

  const handleAllow = async () => {
    const ok = await requestPermission();
    setDismissed(true);
    localStorage.setItem("notif-banner-dismissed", "1");
    if (ok) {
      // toast shown by hook
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("notif-banner-dismissed", "1");
  };

  if (dismissed || permission === "granted" || permission === "denied" || permission === "unsupported") {
    return null;
  }

  return (
    <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 shrink-0" />
        <span>Enable notifications to stay updated on posts, comments, and events.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleAllow}
          className="bg-white text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs hover:bg-indigo-50 transition"
        >
          Enable
        </button>
        <button onClick={handleDismiss} className="hover:opacity-70 transition">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, loading } = useAuth();
  const router = useRouter();
  usePresence();

  // Redirect to onboarding if user hasn't completed it
  useEffect(() => {
    if (!loading && profile && !profile.hasOnboarded) {
      router.replace("/onboarding");
    }
  }, [profile, loading]);

  return (
    <div className="min-h-screen bg-[#F5F4FF]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:top-14 lg:bottom-0 lg:flex lg:w-64 lg:flex-col border-r border-slate-100 shadow-sm z-40">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 shadow-2xl z-10 animate-slide-up">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Push notification prompt */}
        <NotificationBanner />

        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 max-w-5xl w-full mx-auto pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
