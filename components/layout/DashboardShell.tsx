"use client";
import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 max-w-5xl w-full mx-auto pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
